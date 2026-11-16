// -----------------------------------------------------------------------------
// An in-memory OpenFamily server behind a `fetch` stand-in: the routes the
// integration calls, with the answers the real server gives (see the
// OpenFamily API). Tests never touch the network.
// -----------------------------------------------------------------------------

export const URL_BASE = 'http://openfamily.test:3000';
export const TOKEN = `ofk_${'a'.repeat(43)}`;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export function createFakeOpenFamily({ scope = 'write' } = {}) {
  const server = {
    scope,
    down: false,
    /** The code Node gives for the failed connection of a server that is down. */
    failure: 'ECONNREFUSED',
    /** An OpenFamily older than 2.0: it has no API tokens, and refuses every one. */
    legacy: false,
    /** The token was revoked in OpenFamily. */
    revoked: false,
    shopping: [],
    tasks: [],
    appointments: [],
    requests: [],
    nextId: 1,
    /** The family's time zone, as OpenFamily 2.0 gives it; older servers give none. */
    timezone: undefined,
  };

  server.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    const path = url.pathname;
    const bearer = init.headers?.Authorization;
    server.requests.push({ method, path, search: url.search, body, bearer: Boolean(bearer) });
    if (server.down) {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: server.failure } });
    }
    // The route that manages the tokens came with them, in OpenFamily 2.0.
    if (server.legacy && path === '/api/api-tokens') {
      return json(404, { success: false, error: 'Route not found' });
    }
    if (server.legacy || server.revoked || bearer !== `Bearer ${TOKEN}`) {
      return json(401, { success: false, error: 'Invalid token' });
    }
    if (method !== 'GET' && server.scope === 'read') {
      return json(403, { success: false, error: 'read_only_token' });
    }
    const ok = (data) => json(200, { success: true, data });

    if (method === 'GET' && path === '/api/auth/me') {
      return ok({
        user: {
          id: 'u1',
          name: 'Alex',
          email: 'alex@example.org',
          ...(server.timezone ? { timezone: server.timezone } : {}),
        },
      });
    }
    if (method === 'GET' && path === '/api/shopping') return ok(server.shopping);
    if (method === 'POST' && path === '/api/shopping') {
      const item = {
        id: `item-${server.nextId++}`,
        is_checked: false,
        quantity: null,
        unit: null,
        ...body,
      };
      server.shopping.push(item);
      return ok(item);
    }
    if (method === 'GET' && path === '/api/tasks') return ok(server.tasks);
    if (method === 'POST' && path === '/api/tasks') {
      const task = { id: `task-${server.nextId++}`, is_completed: false, due_date: null, ...body };
      server.tasks.push(task);
      return ok(task);
    }
    const put = path.match(/^\/api\/(shopping|tasks)\/([^/]+)$/);
    if (method === 'PUT' && put) {
      const entry = server[put[1]].find((candidate) => candidate.id === decodeURIComponent(put[2]));
      if (!entry) return json(404, { success: false, error: 'Not found' });
      Object.assign(entry, body);
      return ok(entry);
    }
    if (method === 'GET' && path === '/api/appointments') return ok(server.appointments);
    return json(404, { success: false, error: 'Not found' });
  };

  return server;
}
