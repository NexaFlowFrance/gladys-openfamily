// -----------------------------------------------------------------------------
// The integration against the SDK's fake Gladys and an in-memory OpenFamily:
// calendar mirroring, widgets, scene actions, scene triggers, failures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { SCENE_ACTIONS, SCENE_TRIGGERS, WIDGETS, registerHandlers } from '../src/app.js';
import { CLOSE_REFUSED } from '../src/live.js';
import { WIDGET_ACTIONS } from '../src/widgets.js';
import { TOKEN, URL_BASE, createFakeOpenFamily } from './helpers/fakeOpenFamily.js';
import { createFakeWebSocket } from './helpers/fakeWebSocket.js';

const NOW = new Date(2026, 10, 15, 10, 0, 0); // 15 November 2026, 10:00 local
const USER = { selector: 'alex', first_name: 'Alex', language: 'fr' };

async function setup({
  scope = 'write',
  accounts = [{ user: USER, config: {} }],
  config,
  now = () => NOW,
  WebSocketImpl = null,
  stateDir = null,
} = {}) {
  const server = createFakeOpenFamily({ scope });
  const gladys = createFakeGladys({
    config: config ?? { url: `${URL_BASE}/`, token: TOKEN },
    calendarAccounts: accounts,
  });
  const app = registerHandlers(gladys, {
    fetchImpl: server.fetch,
    now,
    WebSocketImpl,
    timers: false,
    stateDir,
  });
  return { server, gladys, app };
}

const events = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const texts = (content) => JSON.stringify(content);
const asked = (server, path) => server.requests.filter((request) => request.path === path);

/** Lets what the integration started on its own (a reading, a status) finish. */
async function until(condition) {
  for (let turn = 0; turn < 200 && !condition(); turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(condition(), 'the expected state never came');
}

test('mirrors the family calendar into a calendar of the user who enabled it', async () => {
  const { server, gladys } = await setup();
  server.appointments = [
    {
      id: 'a1',
      title: 'Dentist',
      start_time: '2026-11-15T09:30:00',
      end_time: '2026-11-15T10:15:00',
      location: 'City Dental',
    },
    {
      id: 'a2',
      occurrence_id: 'a2:2026-11-16',
      title: 'Choir',
      start_time: '2026-11-16T18:00:00',
      end_time: null,
    },
    {
      id: 'a3',
      title: 'School trip',
      start_time: '2026-11-17T00:00:00',
      end_time: '2026-11-18T00:00:00',
      is_all_day: true,
    },
    { id: 'a4', title: '   ', start_time: '2026-11-17T08:00:00' },
  ];
  await gladys.connect();

  const calendarId = 'ext:test-integration:alex:family';
  assert.deepEqual(
    gladys.fake.calendars.map((calendar) => [calendar.external_id, calendar.name, calendar.shared]),
    [[calendarId, 'OpenFamily', false]],
  );
  const stored = gladys.fake.calendarEvents;
  assert.deepEqual(stored.map((event) => event.external_id).sort(), [
    'ext:test-integration:alex:a1',
    'ext:test-integration:alex:a2_2026-11-16',
    'ext:test-integration:alex:a3',
  ]);
  const dentist = stored.find((event) => event.name === 'Dentist');
  assert.equal(dentist.start, new Date('2026-11-15T09:30:00').toISOString());
  assert.equal(dentist.location, 'City Dental');
  const trip = stored.find((event) => event.name === 'School trip');
  assert.equal(trip.full_day, true);
  assert.equal(String(trip.start).slice(0, 10), '2026-11-17');
  assert.equal(String(trip.end).slice(0, 10), '2026-11-19');
  assert.equal(gladys.fake.connectionStatus.connected, true);

  // The range asked from OpenFamily: a month back, a year ahead, local time.
  const asked = server.requests.find((request) => request.path === '/api/appointments');
  assert.match(
    decodeURIComponent(asked.search),
    /start_date=2026-10-16T00:00:00&end_date=2027-11-16T00:00:00/,
  );
});

test('writes the calendar again only when it changed, and prunes what left OpenFamily', async () => {
  const { server, gladys, app } = await setup();
  server.appointments = [
    { id: 'a1', title: 'Dentist', start_time: '2026-11-15T09:30:00' },
    { id: 'a2', title: 'Choir', start_time: '2026-11-16T18:00:00' },
  ];
  await gladys.connect();
  const writes = () => gladys.fake.publishedCalendarEvents.length;
  assert.equal(writes(), 1);

  await app.tick();
  assert.equal(writes(), 1, 'nothing changed: nothing written');

  server.appointments = [{ id: 'a1', title: 'Dentist', start_time: '2026-11-15T09:30:00' }];
  await app.tick();
  assert.equal(writes(), 2);
  assert.deepEqual(
    gladys.fake.calendarEvents.map((event) => event.name),
    ['Dentist'],
  );
});

test('syncs nobody who did not enable it, and skips a calendar switched off', async () => {
  const nobody = await setup({ accounts: [] });
  nobody.server.appointments = [{ id: 'a1', title: 'Dentist', start_time: '2026-11-15T09:30:00' }];
  await nobody.gladys.connect();
  assert.deepEqual(nobody.gladys.fake.publishedCalendars, []);
  assert.equal(
    nobody.server.requests.some((request) => request.path === '/api/appointments'),
    false,
  );

  const { server, gladys, app } = await setup();
  server.appointments = [{ id: 'a1', title: 'Dentist', start_time: '2026-11-15T09:30:00' }];
  await gladys.connect();
  gladys.fake.calendars[0].sync = false;
  gladys.fake.calendarEvents.length = 0;
  server.appointments.push({ id: 'a2', title: 'Choir', start_time: '2026-11-16T18:00:00' });
  await app.tick();
  assert.deepEqual(gladys.fake.calendarEvents, [], 'a 403 would have failed the reading');
  assert.equal(gladys.fake.connectionStatus.connected, true);

  // Switched back on: the core tells the integration, which republishes.
  gladys.fake.calendars[0].sync = true;
  await gladys.fake.calendarAccountUpdated('alex');
  assert.equal(gladys.fake.calendarEvents.length, 2);
});

test('the three widgets render exactly as sent, in their filled and empty states', async () => {
  const { server, gladys } = await setup();
  await gladys.connect();
  for (const key of Object.values(WIDGETS)) {
    const { data } = await gladys.fake.widgetGet(key);
    assert.deepEqual(validateWidgetContent(data.content), [], `empty ${key}`);
  }

  server.shopping = [
    { id: 'i1', name: 'Milk', quantity: '2.00', unit: 'L', is_checked: false },
    { id: 'i2', name: 'Bought', is_checked: true },
    ...Array.from({ length: 12 }, (_, n) => ({
      id: `m${n}`,
      name: `Item ${n}`,
      is_checked: false,
    })),
  ];
  server.tasks = [
    { id: 't1', title: 'Homework', due_date: '2026-11-20', is_completed: false },
    { id: 't2', title: 'Late one', due_date: '2026-11-01', is_completed: false },
    { id: 't3', title: 'Finished', is_completed: true },
  ];
  server.appointments = [
    { id: 'a1', title: 'Dentist', start_time: '2026-11-15T09:30:00' },
    { id: 'a2', title: 'School trip', start_time: '2026-11-15T00:00:00', is_all_day: true },
  ];
  const shopping = (await gladys.fake.widgetGet(WIDGETS.SHOPPING)).data.content;
  const tasks = (await gladys.fake.widgetGet(WIDGETS.TASKS)).data.content;
  const today = (await gladys.fake.widgetGet(WIDGETS.TODAY)).data.content;
  for (const content of [shopping, tasks, today]) {
    assert.deepEqual(validateWidgetContent(content), []);
  }
  assert.ok(texts(shopping).includes('Milk') && texts(shopping).includes('2 L'));
  assert.ok(!texts(shopping).includes('Bought'));
  assert.ok(texts(shopping).includes('13 articles à acheter'));
  // Soonest first, the late one flagged; the finished one is gone.
  const rows = tasks.components.find((component) => component.type === 'status').items;
  assert.deepEqual(
    rows.map((row) => [row.label, row.color]),
    [
      ['Late one', 'danger'],
      ['Homework', 'primary'],
    ],
  );
  assert.ok(texts(today).indexOf('School trip') < texts(today).indexOf('Dentist'));
  assert.ok(texts(today).includes('09:30'));
});

test('widget buttons add and check off, and say so', async () => {
  const { server, gladys } = await setup();
  await gladys.connect();
  const tap = (widget, action, values) =>
    gladys.fake.widgetAction(widget, action, {}, { settings: {}, values });

  let ack = await tap(WIDGETS.SHOPPING, WIDGET_ACTIONS.ADD_ITEM, { item: 'Milk', quantity: '2 L' });
  assert.equal(ack.success, true);
  assert.deepEqual(
    [
      server.shopping[0].name,
      server.shopping[0].quantity,
      server.shopping[0].unit,
      server.shopping[0].category,
    ],
    ['Milk', 2, 'L', 'Autre'],
  );
  ack = await tap(WIDGETS.SHOPPING, WIDGET_ACTIONS.CHECK_ITEM, { item: server.shopping[0].id });
  assert.ok(JSON.stringify(ack.data).includes('Milk coché'));
  assert.equal(server.shopping[0].is_checked, true);

  await tap(WIDGETS.TASKS, WIDGET_ACTIONS.ADD_TASK, { title: 'Homework', due_date: '2026-11-20' });
  assert.equal(server.tasks[0].due_date, '2026-11-20');
  ack = await tap(WIDGETS.TASKS, WIDGET_ACTIONS.ADD_TASK, { title: 'Bad', due_date: 'tomorrow' });
  assert.ok(JSON.stringify(ack.data).includes('AAAA-MM-JJ'));
  assert.equal(server.tasks.length, 1);
  await tap(WIDGETS.TASKS, WIDGET_ACTIONS.COMPLETE_TASK, { task: server.tasks[0].id });
  assert.equal(server.tasks[0].is_completed, true);

  // A Gladys without forms relays the tap with no values: nothing is written.
  ack = await tap(WIDGETS.SHOPPING, WIDGET_ACTIONS.ADD_ITEM, undefined);
  assert.equal(server.shopping.length, 1);
  assert.ok(JSON.stringify(ack.data).includes('plus récente'));
});

test('scene actions write to OpenFamily and return their declared outputs', async () => {
  const { server, gladys } = await setup();
  server.tasks = [{ id: 't1', title: 'Trash', due_date: '2026-11-15', is_completed: false }];
  await gladys.connect();

  let ack = await gladys.fake.sceneAction(SCENE_ACTIONS.ADD_ITEM, {
    item: ' Bread ',
    quantity: 'a big one',
  });
  assert.deepEqual(ack, { success: true, data: { outputs: { item: 'Bread', count: 1 } } });
  assert.equal(server.shopping[0].notes, 'a big one');

  ack = await gladys.fake.sceneAction(SCENE_ACTIONS.ADD_TASK, { title: 'Homework' });
  assert.deepEqual(ack.data.outputs, { title: 'Homework', count: 2 });

  ack = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_SHOPPING, {});
  assert.deepEqual(ack.data.outputs, { count: 1, items: 'Bread' });
  ack = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_TASKS, {});
  assert.deepEqual(ack.data.outputs, { count: 2, due_today: 1, list: 'Trash, Homework' });

  ack = await gladys.fake.sceneAction(SCENE_ACTIONS.ADD_TASK, { title: 'X', due_date: '15/11' });
  assert.equal(ack.success, false);
});

test('fires a trigger for what changed in OpenFamily, never for the first reading', async () => {
  const { server, gladys, app } = await setup();
  server.shopping = [{ id: 'i1', name: 'Milk', is_checked: false }];
  server.tasks = [{ id: 't1', title: 'Trash', is_completed: false }];
  await gladys.connect();
  assert.deepEqual(gladys.fake.sceneEvents, []);

  server.shopping.push({ id: 'i2', name: 'Bread', quantity: 2, unit: null, is_checked: false });
  server.tasks[0].is_completed = true;
  await app.refresh();
  assert.deepEqual(
    events(gladys, SCENE_TRIGGERS.ITEM_ADDED).map((event) => event.data),
    [{ item: 'Bread', quantity: '2', count: 2 }],
  );
  assert.deepEqual(
    events(gladys, SCENE_TRIGGERS.TASK_COMPLETED).map((event) => event.data),
    [{ title: 'Trash', count: 0 }],
  );
  // The open dashboards are told to pull the new content.
  assert.deepEqual([...new Set(gladys.fake.widgetRefreshes)].sort(), [
    WIDGETS.SHOPPING,
    WIDGETS.TASKS,
  ]);

  await app.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 2, 'nothing new: nothing fired');
});

test('never fires back what a scene action of its own added: no loop', async () => {
  const { gladys, app } = await setup();
  await gladys.connect();
  await gladys.fake.sceneAction(SCENE_ACTIONS.ADD_ITEM, { item: 'Bread' });
  await app.refresh();
  assert.deepEqual(events(gladys, SCENE_TRIGGERS.ITEM_ADDED), []);

  // The same item added by a person on the dashboard is an event.
  await gladys.fake.widgetAction(
    WIDGETS.SHOPPING,
    WIDGET_ACTIONS.ADD_ITEM,
    {},
    { settings: {}, values: { item: 'Milk' } },
  );
  assert.deepEqual(
    events(gladys, SCENE_TRIGGERS.ITEM_ADDED).map((event) => event.data.item),
    ['Milk'],
  );
});

test('fires "task due" once per task on its day', async () => {
  const { server, gladys, app } = await setup();
  server.tasks = [
    { id: 't1', title: 'Trash', due_date: '2026-11-15', is_completed: false },
    { id: 't2', title: 'Later', due_date: '2026-11-16', is_completed: false },
    { id: 't3', title: 'Done already', due_date: '2026-11-15', is_completed: true },
  ];
  await gladys.connect();
  await app.refresh();
  assert.deepEqual(
    events(gladys, SCENE_TRIGGERS.TASK_DUE).map((event) => event.data),
    [{ title: 'Trash', due: '2026-11-15', count: 2 }],
  );
});

test('waits for the hour of the day before firing "task due"', async () => {
  const trash = { id: 't1', title: 'Trash', due_date: '2026-11-15', is_completed: false };
  const due = (gladys) => events(gladys, SCENE_TRIGGERS.TASK_DUE);

  // The first reading of the day comes minutes after midnight: nobody is up.
  let now = new Date(2026, 10, 15, 0, 5);
  const { server, gladys, app } = await setup({ now: () => now });
  server.tasks = [trash];
  await gladys.connect();
  assert.deepEqual(due(gladys), []);
  now = new Date(2026, 10, 15, 6, 59, 59);
  await app.refresh();
  assert.deepEqual(due(gladys), []);
  now = new Date(2026, 10, 15, 7, 0, 5);
  await app.refresh();
  assert.equal(due(gladys).length, 1);

  // The hour is a setting.
  const evening = await setup({ config: { url: URL_BASE, token: TOKEN, due_hour: 18 } });
  evening.server.tasks = [trash];
  await evening.gladys.connect();
  assert.deepEqual(due(evening.gladys), [], 'it is 10:00');
  // Past the hour, a task that is given today's date fires at the next reading.
  const morning = await setup({ config: { url: URL_BASE, token: TOKEN, due_hour: 0 } });
  await morning.gladys.connect();
  morning.server.tasks = [trash];
  await morning.app.refresh();
  assert.equal(due(morning.gladys).length, 1);
});

test('remembers the "task due" it fired through a restart, until the next day', async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'gladys-openfamily-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const due = (gladys) => events(gladys, SCENE_TRIGGERS.TASK_DUE);
  const start = async (options) => {
    const started = await setup({ stateDir, ...options });
    started.server.tasks = [
      { id: 't1', title: 'Trash', due_date: '2026-11-15', is_completed: false },
      { id: 't2', title: 'Homework', due_date: '2026-11-16', is_completed: false },
    ];
    await started.gladys.connect();
    return started;
  };

  const first = await start();
  assert.deepEqual(
    due(first.gladys).map((event) => event.data.title),
    ['Trash'],
  );
  // Saving a setting restarts the readings, not the day.
  await first.gladys.fake.configUpdated({ url: URL_BASE, token: TOKEN, poll_minutes: 10 });
  assert.equal(due(first.gladys).length, 1);

  // The container restarts: an update of the integration, a reboot of Gladys.
  const second = await start();
  assert.deepEqual(due(second.gladys), []);

  const nextDay = await start({ now: () => new Date(2026, 10, 16, 10) });
  assert.deepEqual(
    due(nextDay.gladys).map((event) => event.data.title),
    ['Homework'],
  );
});

test('fires "task due" again when Gladys did not receive it', async () => {
  const { server, gladys, app } = await setup();
  server.tasks = [{ id: 't1', title: 'Trash', due_date: '2026-11-15', is_completed: false }];
  const publish = gladys.publishSceneEvent.bind(gladys);
  let reachable = false;
  gladys.publishSceneEvent = async (...args) => {
    if (!reachable) throw new Error('Gladys is restarting');
    return publish(...args);
  };
  await gladys.connect();
  assert.deepEqual(events(gladys, SCENE_TRIGGERS.TASK_DUE), []);
  reachable = true;
  await app.refresh();
  await app.refresh();
  assert.equal(events(gladys, SCENE_TRIGGERS.TASK_DUE).length, 1);
});

test('says what is wrong: not configured, unreachable, token refused, read-only token', async () => {
  const unset = await setup({ config: {} });
  await unset.gladys.connect();
  assert.equal(unset.gladys.fake.connectionStatus.connected, false);
  assert.match(unset.gladys.fake.connectionStatus.message.fr, /jeton d'API/);
  assert.deepEqual(unset.server.requests, []);

  const down = await setup();
  down.server.down = true;
  await down.gladys.connect();
  assert.match(down.gladys.fake.connectionStatus.message.fr, /refuse la connexion/);
  const widget = (await down.gladys.fake.widgetGet(WIDGETS.SHOPPING)).data.content;
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.match(texts(widget), /refuse la connexion/);
  down.server.down = false;
  await down.app.tick();
  assert.equal(down.gladys.fake.connectionStatus.connected, true);

  const refused = await setup({ config: { url: URL_BASE, token: 'ofk_wrong' } });
  await refused.gladys.connect();
  assert.match(refused.gladys.fake.connectionStatus.message.fr, /refusé le jeton/);
  assert.equal((await refused.gladys.fake.action('test_connection', {})).success, false);

  const readOnly = await setup({ scope: 'read' });
  await readOnly.gladys.connect();
  assert.equal(readOnly.gladys.fake.connectionStatus.connected, true);
  const ack = await readOnly.gladys.fake.widgetAction(
    WIDGETS.SHOPPING,
    WIDGET_ACTIONS.ADD_ITEM,
    {},
    { settings: {}, values: { item: 'Milk' } },
  );
  assert.match(JSON.stringify(ack.data), /lecture seule/);
  assert.equal(
    (await readOnly.gladys.fake.sceneAction(SCENE_ACTIONS.ADD_ITEM, { item: 'Milk' })).success,
    false,
  );
});

test('tells an old server from a refused token, and why a server cannot be reached', async () => {
  const status = (gladys) => gladys.fake.connectionStatus.message;

  // OpenFamily before 2.0 has no API tokens: it refuses every one, like a revoked one.
  const old = await setup();
  old.server.legacy = true;
  await old.gladys.connect();
  assert.match(status(old.gladys).fr, /trop ancien/);
  const tested = await old.gladys.fake.action('test_connection', {});
  assert.equal(tested.success, false);
  assert.match(JSON.stringify(tested), /too old/);
  // The question that tells them apart is asked without the token.
  assert.ok(asked(old.server, '/api/api-tokens').length > 0);
  assert.ok(asked(old.server, '/api/api-tokens').every((request) => !request.bearer));

  // A server that knows API tokens is asked once, however often it refuses.
  const refused = await setup({ config: { url: URL_BASE, token: 'ofk_wrong' } });
  await refused.gladys.connect();
  await refused.app.tick();
  assert.match(status(refused.gladys).fr, /refusé le jeton/);
  assert.equal(asked(refused.server, '/api/api-tokens').length, 1);

  const reasons = [
    ['ENOTFOUND', /ne trouve pas le serveur/],
    ['ETIMEDOUT', /ne répond pas/],
    ['ERR_SSL_WRONG_VERSION_NUMBER', /HTTP simple/],
    ['DEPTH_ZERO_SELF_SIGNED_CERT', /certificat/],
    ['ECONNRESET', /injoignable/],
  ];
  for (const [failure, text] of reasons) {
    const down = await setup();
    down.server.down = true;
    down.server.failure = failure;
    await down.gladys.connect();
    assert.match(status(down.gladys).fr, text, failure);
  }

  // From its container, the integration is its own localhost.
  const local = await setup({ config: { url: 'http://localhost:3000', token: TOKEN } });
  local.server.down = true;
  await local.gladys.connect();
  assert.match(status(local.gladys).fr, /localhost désigne/);
});

test('reads at once when the real-time channel is refused, and reopens it after a good reading', async () => {
  const WebSocketImpl = createFakeWebSocket();
  const { sockets } = WebSocketImpl;
  const { server, gladys, app } = await setup({ WebSocketImpl });
  await gladys.connect();
  assert.equal(sockets.length, 1);
  sockets[0].open();
  sockets[0].message({ type: 'auth', success: true });

  // The token is revoked in OpenFamily, which closes the channel: said now,
  // not at the next periodic reading.
  server.revoked = true;
  sockets[0].drop(CLOSE_REFUSED);
  await until(() => gladys.fake.connectionStatus.connected === false);
  assert.match(gladys.fake.connectionStatus.message.fr, /refusé le jeton/);

  // Refused again at the next reading: the channel stays closed.
  await app.poll();
  assert.equal(sockets.length, 1);
  // Both lists were refused, twice: the server was asked once what it knows.
  assert.equal(asked(server, '/api/api-tokens').length, 1);

  // Read again (OpenFamily also closes the channel of a token that still
  // stands, when its account signs out everywhere): the channel reopens.
  server.revoked = false;
  await app.poll();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(sockets.length, 2);
  await app.poll();
  assert.equal(sockets.length, 2, 'an open channel is left alone');
  app.stop();
  assert.equal(sockets[1].closed, true);
});

test('reads only what the real-time channel says changed', async (t) => {
  const { server, gladys, app } = await setup();
  await gladys.connect();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const paths = () => server.requests.map((request) => request.path).sort();
  const settle = async () => {
    for (let turn = 0; turn < 20; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };

  // The channel also announces what the integration never shows.
  server.requests.length = 0;
  for (const entity of ['budget', 'recipes', 'posts']) app.liveUpdate(entity);
  t.mock.timers.tick(60 * 1000);
  await settle();
  assert.deepEqual(paths(), []);

  // A burst of changes to the lists: one reading, and not of the calendar.
  for (const entity of ['shopping', 'shopping', 'tasks']) app.liveUpdate(entity);
  t.mock.timers.tick(1500);
  await until(() => paths().length >= 2);
  await settle();
  assert.deepEqual(paths(), ['/api/shopping', '/api/tasks']);

  server.requests.length = 0;
  const nudges = gladys.fake.widgetRefreshes.length;
  app.liveUpdate('appointments');
  t.mock.timers.tick(1500);
  await until(() => gladys.fake.widgetRefreshes.length > nudges);
  assert.equal(gladys.fake.widgetRefreshes.at(-1), WIDGETS.TODAY);
  assert.deepEqual(paths(), ['/api/appointments']);
});

test('the configuration buttons test the connection and synchronize on demand', async () => {
  const { server, gladys } = await setup();
  server.appointments = [{ id: 'a1', title: 'Dentist', start_time: '2026-11-15T09:30:00' }];
  await gladys.connect();
  const tested = await gladys.fake.action('test_connection', {});
  assert.match(JSON.stringify(tested.data), /en tant que Alex/);
  const synced = await gladys.fake.action('sync_now', {});
  assert.match(JSON.stringify(synced.data), /1 événement pour 1 utilisateur/);
  assert.equal(gladys.fake.publishedCalendarEvents.length, 2, 'forced: written again');
});

test("reads times in the family's own time zone when OpenFamily gives it", async () => {
  const before = process.env.TZ;
  const dentist = { id: 'a1', title: 'Dentist', start_time: '2026-11-15T09:30:00' };
  const startOf = (gladys) =>
    gladys.fake.calendarEvents.find((event) => event.name === 'Dentist').start;
  try {
    // OpenFamily 2.0 says where the family lives: 09:30 there, whatever Gladys' own zone.
    const told = await setup();
    told.server.timezone = 'Asia/Tokyo';
    told.server.appointments = [dentist];
    await told.gladys.connect();
    assert.equal(process.env.TZ, 'Asia/Tokyo');
    assert.equal(startOf(told.gladys), '2026-11-15T00:30:00.000Z');

    // The zone set in the integration's own configuration wins.
    const forced = await setup({
      config: { url: URL_BASE, token: TOKEN, timezone: 'America/New_York' },
    });
    forced.server.timezone = 'Asia/Tokyo';
    forced.server.appointments = [dentist];
    await forced.gladys.connect();
    assert.equal(startOf(forced.gladys), '2026-11-15T14:30:00.000Z');

    // An older server says nothing, or something that is not a zone: nothing changes.
    process.env.TZ = 'Europe/Paris';
    const silent = await setup();
    silent.server.appointments = [dentist];
    await silent.gladys.connect();
    assert.equal(process.env.TZ, 'Europe/Paris');
    const odd = await setup();
    odd.server.timezone = 'Mars/Olympus';
    await odd.gladys.connect();
    assert.equal(process.env.TZ, 'Europe/Paris');
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test('never sends the token anywhere but to the configured server', async () => {
  const { server, gladys } = await setup();
  await gladys.connect();
  await gladys.fake.sceneAction(SCENE_ACTIONS.ADD_ITEM, { item: 'Milk' });
  const sent = JSON.stringify([gladys.fake.requests, gladys.fake.wsMessages]);
  assert.ok(!sent.includes(TOKEN));
  assert.ok(server.requests.length > 0);
});
