// -----------------------------------------------------------------------------
// The pure parts: configuration, quantities, calendar conversion and windows.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, isConfigured, normalizeConfig } from '../src/config.js';
import { parseQuantity } from '../src/openfamily.js';
import { splitWindows, syncWindow, toGladysEvent } from '../src/calendar.js';

test('normalizes the configuration, with the manifest defaults', () => {
  assert.deepEqual(normalizeConfig(), {
    url: '',
    token: '',
    pollMinutes: DEFAULT_CONFIG.poll_minutes,
    shoppingCategory: DEFAULT_CONFIG.shopping_category,
    timeZone: '',
  });
  const config = normalizeConfig({
    url: ' https://family.example.org// ',
    token: ' ofk_x ',
    poll_minutes: '999',
    shopping_category: ' Épicerie ',
  });
  assert.deepEqual(config, {
    url: 'https://family.example.org',
    token: 'ofk_x',
    pollMinutes: 60,
    shoppingCategory: 'Épicerie',
    timeZone: '',
  });
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
