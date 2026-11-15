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
  READ_ONLY: 'read_only',
  FORBIDDEN: 'forbidden',
  SERVER: 'server',
};

export class OpenFamilyError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
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
      throw new OpenFamilyError(ERRORS.UNREACHABLE, err?.cause?.code ?? err?.name ?? '');
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // Not JSON: a proxy's error page, or another service at this address.
    }
    if (response.status === 401) {
      throw new OpenFamilyError(ERRORS.UNAUTHORIZED);
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
