// -----------------------------------------------------------------------------
// OpenFamily's real-time channel: a WebSocket that says which kind of data
// just changed ({ type: 'update', entity: 'shopping' | 'tasks' | ... }). It
// only makes the integration read sooner: the periodic reading stays the
// source of truth, so a channel that never connects costs nothing but delay.
// -----------------------------------------------------------------------------

const FIRST_RETRY_MS = 5000;
const MAX_RETRY_MS = 5 * 60 * 1000;

/**
 * @param {object} options
 * @param {string} options.url the server address (http or https)
 * @param {string} options.token the API token
 * @param {(entity: string) => void} options.onUpdate
 * @param {typeof WebSocket} [options.WebSocketImpl]
 * @returns {() => void} stops the channel
 */
export function connectLive({ url, token, onUpdate, WebSocketImpl = globalThis.WebSocket }) {
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
        if (message.type === 'auth' && message.success) {
          delay = FIRST_RETRY_MS;
        } else if (message.type === 'update' && typeof message.entity === 'string') {
          onUpdate(message.entity);
        }
      } catch {
        // Not for us.
      }
    };
    socket.onerror = () => {};
    socket.onclose = retry;
  }

  open();
  return () => {
    stopped = true;
    clearTimeout(timer);
    try {
      socket?.close();
    } catch {
      // Already closed.
    }
  };
}
