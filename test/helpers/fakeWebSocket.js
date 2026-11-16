// -----------------------------------------------------------------------------
// A WebSocket stand-in: the test plays OpenFamily's side of the real-time
// channel (open, message, drop) and reads what the integration sent.
// -----------------------------------------------------------------------------

/** A fresh class per test, with every socket it opened in `sockets`. */
export function createFakeWebSocket() {
  return class FakeWebSocket {
    static sockets = [];

    static get last() {
      return FakeWebSocket.sockets.at(-1);
    }

    constructor(url) {
      this.url = url;
      this.sent = [];
      this.closed = false;
      FakeWebSocket.sockets.push(this);
    }

    send(data) {
      this.sent.push(JSON.parse(data));
    }

    close() {
      this.closed = true;
    }

    // --- OpenFamily's side -------------------------------------------------------

    open() {
      this.onopen?.();
    }

    message(data) {
      this.onmessage?.({ data: JSON.stringify(data) });
    }

    /** The connection ends, with the close code the server gave (1006: none). */
    drop(code = 1006) {
      this.onclose?.({ code });
    }
  };
}
