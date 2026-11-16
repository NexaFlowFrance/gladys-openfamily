// -----------------------------------------------------------------------------
// OpenFamily's real-time channel: a WebSocket that says which kind of data
// just changed ({ type: 'update', entity: 'shopping' | 'tasks' | ... }). It
// only makes the integration read sooner: the periodic reading stays the
// source of truth, so a channel that never connects costs nothing but delay.
// -----------------------------------------------------------------------------

const FIRST_RETRY_MS = 5000;
const MAX_RETRY_MS = 5 * 60 * 1000;

/** The close code of a channel whose token OpenFamily refuses, or has just revoked. */
export const CLOSE_REFUSED = 4001;

/**
 * @param {object} options
 * @param {string} options.url the server address (http or https)
 * @param {string} options.token the API token
 * @param {(entity: string) => void} options.onUpdate
 * @param {() => void} [options.onRefused] the token was refused: the channel
 *   has stopped for good, trying again would only be refused again
 * @param {typeof WebSocket} [options.WebSocketImpl]
 * @returns {() => void} stops the channel
 */
export function connectLive({
  url,
  token,
  onUpdate,
  onRefused,
  WebSocketImpl = globalThis.WebSocket,
}) {
  if (typeof WebSocketImpl !== 'function') {
    return () => {};
  }
  let stopped = false;
  let socket = null;
  let timer = null;
  let delay = FIRST_RETRY_MS;

  const retry = () => {
    if (stopped) return;
    timer = setTimeout(open, delay);
    timer.unref?.();
    delay = Math.min(delay * 2, MAX_RETRY_MS);
  };

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    try {
      socket?.close();
    } catch {
      // Already closed.
    }
  };

  // OpenFamily answers a token it refuses, then closes with CLOSE_REFUSED; a
  // token revoked later only gets the close. Either way, once.
  const refused = () => {
    if (stopped) return;
    stop();
    onRefused?.();
  };

  function open() {
    if (stopped) return;
    try {
      socket = new WebSocketImpl(`${url.replace(/^http/, 'ws')}/ws`);
    } catch {
      retry();
      return;
    }
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === 'auth') {
          if (message.success) delay = FIRST_RETRY_MS;
          else refused();
        } else if (message.type === 'update' && typeof message.entity === 'string') {
          onUpdate(message.entity);
        }
      } catch {
        // Not for us.
      }
    };
    socket.onerror = () => {};
    socket.onclose = (event) => (event?.code === CLOSE_REFUSED ? refused() : retry());
  }

  open();
  return stop;
}
