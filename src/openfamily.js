// -----------------------------------------------------------------------------
// The OpenFamily REST API, as this integration uses it. Authenticated with a
// personal API token (OpenFamily: Settings -> API tokens), sent as a bearer.
// No dependency: Node's global fetch.
// -----------------------------------------------------------------------------

const TIMEOUT_MS = 15000;

export const ERRORS = {
  NOT_CONFIGURED: 'not_configured',
  UNREACHABLE: 'unreachable',
  UNAUTHORIZED: 'unauthorized',
  TOO_OLD: 'too_old',
  READ_ONLY: 'read_only',
  FORBIDDEN: 'forbidden',
  SERVER: 'server',
};

/** Why a server could not be reached, when the failure says so. */
export const REASONS = {
  LOOPBACK: 'loopback',
  DNS: 'dns',
  REFUSED: 'refused',
  TIMEOUT: 'timeout',
  PROTOCOL: 'protocol',
  CERTIFICATE: 'certificate',
};

export class OpenFamilyError extends Error {
  /**
   * @param {string} code one of ERRORS
   * @param {string} [detail] for the logs
   * @param {string} [reason] one of REASONS, for an unreachable server
   */
  constructor(code, detail = '', reason = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.reason = reason;
  }
}

const REASON_BY_CODE = {
  ENOTFOUND: REASONS.DNS,
  EAI_AGAIN: REASONS.DNS,
  ECONNREFUSED: REASONS.REFUSED,
  ETIMEDOUT: REASONS.TIMEOUT,
  EHOSTUNREACH: REASONS.TIMEOUT,
  ENETUNREACH: REASONS.TIMEOUT,
  UND_ERR_CONNECT_TIMEOUT: REASONS.TIMEOUT,
  UND_ERR_HEADERS_TIMEOUT: REASONS.TIMEOUT,
  // An https:// address answered in plain HTTP.
  ERR_SSL_WRONG_VERSION_NUMBER: REASONS.PROTOCOL,
};
const CERTIFICATE_CODE = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER|ALTNAME/;

/**
 * What a failed fetch says about the failure: the code Node gives (on the
 * cause, or on the first of the addresses tried) and the reason it stands for.
 */
export function networkFailure(err) {
  const cause = err?.cause;
  const code = String(cause?.code ?? cause?.errors?.[0]?.code ?? '');
  if (err?.name === 'TimeoutError') {
    return { detail: err.name, reason: REASONS.TIMEOUT };
  }
  const reason = REASON_BY_CODE[code] ?? (CERTIFICATE_CODE.test(code) ? REASONS.CERTIFICATE : '');
  return { detail: code || err?.name || '', reason };
}

/**
 * True for an address of the machine itself (localhost, 127.x.x.x, ::1). The
 * integration runs in its own container: such an address is the container,
 * never the machine OpenFamily runs on.
 */
export function isLoopback(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '[::1]' || /^127(\.\d+){3}$/.test(hostname);
  } catch {
    return false;
  }
}

/** "2 L" -> { quantity: 2, unit: 'L' }; anything else is kept as a note. */
export function parseQuantity(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) {
    return {};
  }
  const match = raw.match(/^(\d+(?:[.,]\d+)?)\s*(.{0,20})$/);
  if (!match) {
    return { notes: raw.slice(0, 200) };
  }
  const unit = match[2].trim();
  return { quantity: Number(match[1].replace(',', '.')), ...(unit ? { unit } : {}) };
}

export class OpenFamilyClient {
  /**
   * @param {object} options
   * @param {string} options.url the server address, no trailing slash
   * @param {string} options.token a personal API token (ofk_...)
   * @param {typeof fetch} [options.fetchImpl]
   */
  constructor({ url, token, fetchImpl = globalThis.fetch }) {
    this.url = url;
    this.token = token;
    this.fetchImpl = fetchImpl;
    /** Whether the server is known to have API tokens (see knowsApiTokens). */
    this.recent = false;
  }

  async request(method, path, body) {
    if (!this.url || !this.token) {
      throw new OpenFamilyError(ERRORS.NOT_CONFIGURED);
    }
    let response;
    try {
      response = await this.fetchImpl(`${this.url}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const { detail, reason } = networkFailure(err);
      throw new OpenFamilyError(
        ERRORS.UNREACHABLE,
        detail,
        isLoopback(this.url) ? REASONS.LOOPBACK : reason,
      );
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // Not JSON: a proxy's error page, or another service at this address.
    }
    if (response.status === 401) {
      throw new OpenFamilyError(
        (await this.knowsApiTokens()) ? ERRORS.UNAUTHORIZED : ERRORS.TOO_OLD,
      );
    }
    if (response.status === 403) {
      throw new OpenFamilyError(
        payload?.error === 'read_only_token' ? ERRORS.READ_ONLY : ERRORS.FORBIDDEN,
        typeof payload?.error === 'string' ? payload.error : '',
      );
    }
    if (!response.ok || !payload || payload.success !== true) {
      throw new OpenFamilyError(ERRORS.SERVER, `HTTP ${response.status}`);
    }
    return payload.data;
  }

  /**
   * Tells a refused token from a server that has no API tokens at all. API
   * tokens came with OpenFamily 2.0: an older server refuses every one of them
   * like a revoked one, and does not know the route that manages them (404,
   * where a 2.0 answers 401 to a request without a token). Asked without the
   * token, and only after a refusal. In doubt, the server is taken as recent.
   * A server that knows them is not asked again: only an old one can change,
   * the day it is updated. And it is asked once at a time: a reading asks for
   * several lists at once, and each of them is refused.
   */
  knowsApiTokens() {
    this.asking ??= this.askApiTokens().finally(() => {
      this.asking = undefined;
    });
    return this.asking;
  }

  async askApiTokens() {
    if (this.recent) return true;
    try {
      const response = await this.fetchImpl(`${this.url}/api/api-tokens`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      this.recent = response.status !== 404;
      return this.recent;
    } catch {
      return true;
    }
  }

  /** The account the token stands for: { id, name, email, ... }. */
  async me() {
    return (await this.request('GET', '/api/auth/me')).user;
  }

  shopping() {
    return this.request('GET', '/api/shopping');
  }

  addShoppingItem({ name, quantity, category }) {
    return this.request('POST', '/api/shopping', { name, category, ...parseQuantity(quantity) });
  }

  checkShoppingItem(id) {
    return this.request('PUT', `/api/shopping/${encodeURIComponent(id)}`, { is_checked: true });
  }

  tasks() {
    return this.request('GET', '/api/tasks');
  }

  addTask({ title, dueDate }) {
    return this.request('POST', '/api/tasks', { title, ...(dueDate ? { due_date: dueDate } : {}) });
  }

  completeTask(id) {
    return this.request('PUT', `/api/tasks/${encodeURIComponent(id)}`, { is_completed: true });
  }

  /** Appointments between two local date-times, recurring ones expanded into occurrences. */
  appointments(start, end) {
    const query = new URLSearchParams({ start_date: start, end_date: end });
    return this.request('GET', `/api/appointments?${query}`);
  }
}
