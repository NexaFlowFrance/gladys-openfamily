// -----------------------------------------------------------------------------
// The pure parts: configuration, quantities, calendar conversion and windows.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG, isConfigured, normalizeConfig } from '../src/config.js';
import {
  ERRORS,
  OpenFamilyError,
  REASONS,
  isLoopback,
  networkFailure,
  parseQuantity,
} from '../src/openfamily.js';
import { splitWindows, syncWindow, toGladysEvent } from '../src/calendar.js';
import { createStateStore } from '../src/state.js';
import { assignees, findMember, plainName } from '../src/family.js';
import { dayMeals, mealName } from '../src/meals.js';
import { T, errorText } from '../src/i18n.js';

test('normalizes the configuration, with the manifest defaults', () => {
  assert.deepEqual(normalizeConfig(), {
    url: '',
    token: '',
    pollMinutes: DEFAULT_CONFIG.poll_minutes,
    shoppingCategory: DEFAULT_CONFIG.shopping_category,
    dueHour: DEFAULT_CONFIG.due_hour,
    timeZone: '',
  });
  const config = normalizeConfig({
    url: ' https://family.example.org// ',
    token: ' ofk_x ',
    poll_minutes: '999',
    shopping_category: ' Épicerie ',
    due_hour: '18',
  });
  assert.deepEqual(config, {
    url: 'https://family.example.org',
    token: 'ofk_x',
    pollMinutes: 60,
    shoppingCategory: 'Épicerie',
    dueHour: 18,
    timeZone: '',
  });
  // Midnight is an hour like another; what is not an hour of the day is brought back to one.
  assert.equal(normalizeConfig({ due_hour: 0 }).dueHour, 0);
  assert.equal(normalizeConfig({ due_hour: 24 }).dueHour, 23);
  assert.equal(normalizeConfig({ due_hour: '' }).dueHour, DEFAULT_CONFIG.due_hour);
  assert.equal(normalizeConfig({ timezone: ' Europe/Paris ' }).timeZone, 'Europe/Paris');
  assert.equal(normalizeConfig({ timezone: 'Paris' }).timeZone, '');
  assert.equal(isConfigured(config), true);
  // Not an address a request can be sent to: treated as missing.
  assert.equal(normalizeConfig({ url: 'ftp://nas', token: 'ofk_x' }).url, '');
  assert.equal(isConfigured(normalizeConfig({ url: 'family.local', token: 'ofk_x' })), false);
});

test('reads a quantity as OpenFamily stores it, or keeps it as a note', () => {
  assert.deepEqual(parseQuantity('2 L'), { quantity: 2, unit: 'L' });
  assert.deepEqual(parseQuantity('1,5kg'), { quantity: 1.5, unit: 'kg' });
  assert.deepEqual(parseQuantity('6'), { quantity: 6 });
  assert.deepEqual(parseQuantity('a big one'), { notes: 'a big one' });
  assert.deepEqual(parseQuantity(''), {});
  assert.deepEqual(parseQuantity(undefined), {});
});

test('reads why a request failed from what Node says about it', () => {
  const failed = (cause) => Object.assign(new TypeError('fetch failed'), { cause });
  const reason = (err) => networkFailure(err).reason;
  assert.equal(reason(failed({ code: 'ENOTFOUND' })), REASONS.DNS);
  assert.equal(reason(failed({ code: 'EAI_AGAIN' })), REASONS.DNS);
  assert.equal(reason(failed({ code: 'ECONNREFUSED' })), REASONS.REFUSED);
  assert.equal(reason(failed({ code: 'EHOSTUNREACH' })), REASONS.TIMEOUT);
  assert.equal(reason(failed({ code: 'UND_ERR_CONNECT_TIMEOUT' })), REASONS.TIMEOUT);
  assert.equal(reason(failed({ code: 'ERR_SSL_WRONG_VERSION_NUMBER' })), REASONS.PROTOCOL);
  for (const code of [
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'CERT_HAS_EXPIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID',
  ]) {
    assert.equal(reason(failed({ code })), REASONS.CERTIFICATE, code);
  }
  // Several addresses tried (IPv6 then IPv4): the first failure speaks.
  assert.equal(reason(failed({ errors: [{ code: 'ECONNREFUSED' }] })), REASONS.REFUSED);
  // The request's own time limit.
  const late = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  assert.deepEqual(networkFailure(late), { detail: 'TimeoutError', reason: REASONS.TIMEOUT });
  // Anything else keeps its code for the logs, and gets the general text.
  assert.deepEqual(networkFailure(failed({ code: 'ECONNRESET' })), {
    detail: 'ECONNRESET',
    reason: '',
  });
  assert.deepEqual(networkFailure(new TypeError('fetch failed')), {
    detail: 'TypeError',
    reason: '',
  });

  assert.equal(isLoopback('http://localhost:3000'), true);
  assert.equal(isLoopback('http://127.0.0.1:3000'), true);
  assert.equal(isLoopback('http://[::1]:3000'), true);
  assert.equal(isLoopback('http://192.168.1.20:3000'), false);
  assert.equal(isLoopback('http://localhost.example.org'), false);
  assert.equal(isLoopback(''), false);
});

test('every error has a text in both languages, short enough for a widget button', () => {
  const errors = [
    ...Object.values(ERRORS).map((code) => new OpenFamilyError(code)),
    ...Object.values(REASONS).map((reason) => new OpenFamilyError(ERRORS.UNREACHABLE, '', reason)),
  ];
  const seen = new Set();
  for (const err of errors) {
    const text = errorText(err);
    seen.add(text);
    for (const language of ['en', 'fr']) {
      assert.ok(text[language], `${err.message}: ${language}`);
      // Gladys cuts the message of a widget button at 200 characters.
      assert.ok(text[language].length <= 200, `${text[language].length}: ${text[language]}`);
    }
  }
  assert.equal(seen.size, errors.length, 'one text per error and per reason');
  // The longest first name kept still leaves room for the sentence around it.
  for (const text of Object.values(T.noMember('x'.repeat(40)))) {
    assert.ok(text.length <= 200, String(text.length));
  }
  assert.equal(errorText(new Error('anything else')), T.errors[ERRORS.SERVER]);
  assert.equal(
    errorText(new OpenFamilyError(ERRORS.UNREACHABLE, 'ECONNRESET')),
    T.errors[ERRORS.UNREACHABLE],
  );
});

test('keeps its state in a file, and does without when it cannot', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'gladys-openfamily-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createStateStore(dir);
  assert.deepEqual(store.load(), {}, 'nothing saved yet');
  assert.equal(store.save({ firedDue: ['t1:2026-11-15'] }), true);
  assert.deepEqual(createStateStore(dir).load(), { firedDue: ['t1:2026-11-15'] });
  assert.deepEqual(await readdir(dir), ['state.json'], 'no half-written file left');

  // A file that cannot be read as a state counts as none.
  for (const content of ['{ "firedDue": [', '[1, 2]', 'null']) {
    await writeFile(join(dir, 'state.json'), content);
    assert.deepEqual(store.load(), {});
  }

  // No directory, or one that cannot be written: silently in memory only.
  const nowhere = createStateStore(null);
  assert.equal(nowhere.save({ firedDue: [] }), false);
  assert.deepEqual(nowhere.load(), {});
  const missing = createStateStore(join(dir, 'missing'));
  assert.equal(missing.save({ firedDue: [] }), false);
  assert.deepEqual(missing.load(), {});
});

test('finds the family member a typed first name stands for', () => {
  const family = [
    { id: 'm1', name: 'Léa' },
    { id: 'm2', name: 'Tom Martin' },
    { id: 'm3', name: 'Tom Durand' },
    { id: 'm4', name: 'Anne-Sophie' },
    { id: 'm5' },
  ];
  assert.equal(plainName('  Éloïse '), 'eloise');
  assert.equal(findMember(family, 'léa').id, 'm1');
  assert.equal(findMember(family, ' LEA ').id, 'm1');
  assert.equal(findMember(family, 'tom martin').id, 'm2');
  assert.equal(findMember(family, 'anne-sophie').id, 'm4');
  // A first name two members share tells nobody; nor does part of a name.
  assert.equal(findMember(family, 'Tom'), undefined);
  assert.equal(findMember(family, 'Anne'), undefined);
  assert.equal(findMember(family, 'Zoé'), undefined);
  assert.equal(findMember(family, ''), undefined);
  assert.equal(findMember(undefined, 'Léa'), undefined);
  // The full name wins over a first name that is also someone else's.
  assert.equal(findMember([...family, { id: 'm6', name: 'Tom' }], 'tom').id, 'm6');

  assert.equal(
    assignees({ assigned_to_members: [{ name: 'Léa' }, { name: ' Tom ' }, {}] }),
    'Léa, Tom',
  );
  assert.equal(assignees({ assigned_to_members: [] }), '');
  assert.equal(assignees({}), '');
});

test('reads the meals of a day in the order of the day', () => {
  const plans = [
    { date: '2026-11-15', meal_type: 'Snack', custom_meal: 'Fruit' },
    { date: '2026-11-15', meal_type: 'Dîner', recipe: { name: 'Lasagne' }, custom_meal: 'typed' },
    { date: '2026-11-15', meal_type: 'Brunch', custom_meal: 'Eggs' },
    { date: '2026-11-15', meal_type: 'Petit-déjeuner', custom_meal: ' Pancakes ' },
    { date: '2026-11-15T00:00:00', meal_type: 'Déjeuner', custom_meal: 'Salad' },
    { date: '2026-11-15', meal_type: 'Dîner', recipe: null, custom_meal: null },
    { date: '2026-11-16', meal_type: 'Dîner', custom_meal: 'Tomorrow' },
    { meal_type: 'Dîner', custom_meal: 'No date' },
    null,
  ];
  assert.deepEqual(
    dayMeals(plans, '2026-11-15').map((meal) => [meal.type, meal.name]),
    [
      ['breakfast', 'Pancakes'],
      ['lunch', 'Salad'],
      ['dinner', 'Lasagne'],
      ['snack', 'Fruit'],
      ['', 'Eggs'],
    ],
  );
  // A meal type of the family's own keeps its name.
  assert.equal(dayMeals(plans, '2026-11-15').at(-1).label, 'Brunch');
  assert.deepEqual(dayMeals(plans, '2026-11-17'), []);
  assert.deepEqual(dayMeals(undefined, '2026-11-15'), []);
  assert.equal(mealName({ recipe: { name: 'Soup' }, custom_meal: 'x' }), 'Soup');
  assert.equal(mealName({}), '');
});

const idFor = (id) => `ext:x:u:${id}`;

test('converts timed, open-ended and full-day appointments', () => {
  assert.deepEqual(
    toGladysEvent(
      {
        id: 'a',
        title: ' Dentist ',
        start_time: '2026-11-15T09:30:00',
        end_time: '2026-11-15T10:00:00',
        notes: 'Bring the card',
      },
      idFor,
    ),
    {
      external_id: 'ext:x:u:a',
      name: 'Dentist',
      description: 'Bring the card',
      full_day: false,
      start: new Date('2026-11-15T09:30:00').toISOString(),
      end: new Date('2026-11-15T10:00:00').toISOString(),
    },
  );
  // No end, or an end before the start: a zero-duration event, never an invalid one.
  const open = toGladysEvent(
    { id: 'b', title: 'Call', start_time: '2026-11-15T09:30:00', end_time: '2026-11-15T09:00:00' },
    idFor,
  );
  assert.equal(open.end, undefined);
  // A single full day ends, exclusively, on the next one.
  const day = toGladysEvent(
    { id: 'c', title: 'Holiday', start_time: '2026-12-31T00:00:00', is_all_day: true },
    idFor,
  );
  assert.deepEqual([day.start, day.end, day.full_day], ['2026-12-31', '2027-01-01', true]);
  assert.equal(
    toGladysEvent({ id: 'd', title: '', start_time: '2026-11-15T09:30:00' }, idFor),
    null,
  );
  assert.equal(toGladysEvent({ id: 'e', title: 'No date' }, idFor), null);
  assert.equal(
    toGladysEvent({ id: 'f', title: 'x'.repeat(300), start_time: '2026-11-15T09:30:00' }, idFor)
      .name.length,
    200,
  );
});

test('splits a crowded range into disjoint windows the core accepts', () => {
  const window = syncWindow(new Date(2026, 10, 15, 10));
  const events = Array.from({ length: 1200 }, (_, n) => ({
    external_id: `e${n}`,
    name: 'Event',
    full_day: false,
    start: new Date(2026, 10, 15 + (n % 300), 9).toISOString(),
  }));
  const parts = splitWindows(events, window, 500);
  assert.ok(parts.length > 1);
  for (const [index, part] of parts.entries()) {
    assert.ok(part.events.length <= 500);
    if (index > 0) {
      assert.equal(part.window.from.getTime(), parts[index - 1].window.to.getTime());
    }
  }
  assert.equal(parts[0].window.from.getTime(), window.from.getTime());
  assert.equal(parts.at(-1).window.to.getTime(), window.to.getTime());
  assert.equal(
    parts.reduce((sum, part) => sum + part.events.length, 0),
    1200,
  );

  // An event outside the range is never sent: the core would refuse the request.
  const outside = [
    { external_id: 'old', name: 'Old', full_day: true, start: '2020-01-01', end: '2020-01-02' },
  ];
  assert.deepEqual(splitWindows(outside, window)[0].events, []);
});
