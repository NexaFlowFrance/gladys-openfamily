// -----------------------------------------------------------------------------
// OpenFamily's real-time channel: signing in, the updates, coming back after
// a drop, and stopping for good when the token is refused.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOSE_REFUSED, connectLive } from '../src/live.js';
import { createFakeWebSocket } from './helpers/fakeWebSocket.js';

const TOKEN = 'ofk_token';

function setup(t, url = 'http://openfamily.test:3000') {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const WebSocketImpl = createFakeWebSocket();
  const seen = { updates: [], refused: 0 };
  const stop = connectLive({
    url,
    token: TOKEN,
    WebSocketImpl,
    onUpdate: (entity) => seen.updates.push(entity),
    onRefused: () => {
      seen.refused += 1;
    },
  });
  return { sockets: WebSocketImpl.sockets, seen, stop };
}

test('signs in with the token and passes on what changed', (t) => {
  const { sockets, seen } = setup(t, 'https://family.example.org');
  assert.equal(sockets[0].url, 'wss://family.example.org/ws');
  sockets[0].open();
  assert.deepEqual(sockets[0].sent, [{ type: 'auth', token: TOKEN }]);
  sockets[0].message({ type: 'auth', success: true });
  sockets[0].message({ type: 'update', entity: 'shopping', action: 'created' });
  sockets[0].message({ type: 'update' });
  sockets[0].onmessage({ data: 'not json' });
  assert.deepEqual(seen, { updates: ['shopping'], refused: 0 });
});

test('comes back after a drop, waiting longer each time, until stopped', (t) => {
  const { sockets, stop } = setup(t);
  assert.equal(sockets[0].url, 'ws://openfamily.test:3000/ws');
  sockets[0].drop();
  t.mock.timers.tick(4999);
  assert.equal(sockets.length, 1);
  t.mock.timers.tick(1);
  assert.equal(sockets.length, 2);

  sockets[1].drop();
  t.mock.timers.tick(5000);
  assert.equal(sockets.length, 2, 'the second wait is twice the first');
  t.mock.timers.tick(5000);
  assert.equal(sockets.length, 3);

  // Signed in again: the next drop waits the first delay again.
  sockets[2].open();
  sockets[2].message({ type: 'auth', success: true });
  sockets[2].drop();
  t.mock.timers.tick(5000);
  assert.equal(sockets.length, 4);

  stop();
  assert.equal(sockets[3].closed, true);
  sockets[3].drop();
  t.mock.timers.tick(60 * 60 * 1000);
  assert.equal(sockets.length, 4);
});

test('stops for good when OpenFamily refuses the token, and says so once', (t) => {
  const { sockets, seen } = setup(t);
  sockets[0].open();
  // What the server does with a token it does not know: an answer, then the close.
  sockets[0].message({ type: 'auth', success: false });
  sockets[0].drop(CLOSE_REFUSED);
  assert.equal(seen.refused, 1);
  assert.equal(sockets[0].closed, true);
  t.mock.timers.tick(60 * 60 * 1000);
  assert.equal(sockets.length, 1, 'trying again would only be refused again');
});

test('stops the same way when the token is revoked while connected', (t) => {
  const { sockets, seen } = setup(t);
  sockets[0].open();
  sockets[0].message({ type: 'auth', success: true });
  sockets[0].drop(CLOSE_REFUSED);
  assert.equal(seen.refused, 1);
  t.mock.timers.tick(60 * 60 * 1000);
  assert.equal(sockets.length, 1);
});

test('does nothing without a WebSocket implementation', () => {
  const stop = connectLive({ url: 'http://x', token: TOKEN, onUpdate() {}, WebSocketImpl: null });
  assert.equal(typeof stop, 'function');
  stop();
});
