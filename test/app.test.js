// -----------------------------------------------------------------------------
// The integration against the SDK's fake Gladys and an in-memory OpenFamily:
// calendar mirroring, widgets, scene actions, scene triggers, failures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { SCENE_ACTIONS, SCENE_TRIGGERS, WIDGETS, registerHandlers } from '../src/app.js';
import { WIDGET_ACTIONS } from '../src/widgets.js';
import { TOKEN, URL_BASE, createFakeOpenFamily } from './helpers/fakeOpenFamily.js';

const NOW = new Date(2026, 10, 15, 10, 0, 0); // 15 November 2026, 10:00 local
const USER = { selector: 'alex', first_name: 'Alex', language: 'fr' };

async function setup({ scope = 'write', accounts = [{ user: USER, config: {} }], config } = {}) {
  const server = createFakeOpenFamily({ scope });
  const gladys = createFakeGladys({
    config: config ?? { url: `${URL_BASE}/`, token: TOKEN },
    calendarAccounts: accounts,
  });
  const app = registerHandlers(gladys, {
    fetchImpl: server.fetch,
    now: () => NOW,
    WebSocketImpl: null,
    timers: false,
  });
  return { server, gladys, app };
}

const events = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const texts = (content) => JSON.stringify(content);

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

test('says what is wrong: not configured, unreachable, token refused, read-only token', async () => {
  const unset = await setup({ config: {} });
  await unset.gladys.connect();
  assert.equal(unset.gladys.fake.connectionStatus.connected, false);
  assert.match(unset.gladys.fake.connectionStatus.message.fr, /jeton d'API/);
  assert.deepEqual(unset.server.requests, []);

  const down = await setup();
  down.server.down = true;
  await down.gladys.connect();
  assert.match(down.gladys.fake.connectionStatus.message.fr, /injoignable/);
  const widget = (await down.gladys.fake.widgetGet(WIDGETS.SHOPPING)).data.content;
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.match(texts(widget), /injoignable/);
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

test('never sends the token anywhere but to the configured server', async () => {
  const { server, gladys } = await setup();
  await gladys.connect();
  await gladys.fake.sceneAction(SCENE_ACTIONS.ADD_ITEM, { item: 'Milk' });
  const sent = JSON.stringify([gladys.fake.requests, gladys.fake.wsMessages]);
  assert.ok(!sent.includes(TOKEN));
  assert.ok(server.requests.length > 0);
});
