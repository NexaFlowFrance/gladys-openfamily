// -----------------------------------------------------------------------------
// OpenFamily appointments -> Gladys calendar events. Pure.
//
// OpenFamily stores local date-times without a zone ("2026-11-15T09:30:00"):
// they are read in the time zone of this process, which the Gladys supervisor
// sets to the instance's (TZ). Recurring appointments arrive already expanded
// into occurrences by the OpenFamily API.
// -----------------------------------------------------------------------------

export const MAX_EVENTS_PER_REQUEST = 500;
export const HISTORY_DAYS = 30;
export const HORIZON_MONTHS = 12;

const pad = (n) => String(n).padStart(2, '0');

/** A Date as OpenFamily writes it: local, no zone. */
export const naive = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
  `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

export const localDay = (date) => naive(date).slice(0, 10);

/** The day ('YYYY-MM-DD') that comes `days` days after `day`. */
export const addDays = (day, days) => {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + days));
};

const cut = (value, max) => {
  const textValue = typeof value === 'string' ? value.trim() : '';
  return textValue.length > max ? `${textValue.slice(0, max - 1)}…` : textValue;
};

/** The synchronized range: a month of history, twelve months ahead, on day boundaries. */
export function syncWindow(now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - HISTORY_DAYS);
  const to = new Date(now.getFullYear(), now.getMonth() + HORIZON_MONTHS, now.getDate() + 1);
  return { from, to };
}

/**
 * One appointment (or occurrence) as a Gladys event, or null when it cannot be
 * one. `idFor` builds the user-scoped external id from the provider id.
 */
export function toGladysEvent(appointment, idFor) {
  const name = cut(appointment?.title, 200);
  const startRaw = typeof appointment?.start_time === 'string' ? appointment.start_time : '';
  if (!name || !/^\d{4}-\d{2}-\d{2}/.test(startRaw)) {
    return null;
  }
  // An occurrence id is "<uuid>:<date>": the colon is the separator of external ids.
  const providerId = String(appointment.occurrence_id ?? appointment.id).replace(':', '_');
  const event = { external_id: idFor(providerId), name };
  const location = cut(appointment.location, 500);
  const description = cut(appointment.notes || appointment.description, 1000);
  if (location) event.location = location;
  if (description) event.description = description;

  if (appointment.is_all_day) {
    const startDay = startRaw.slice(0, 10);
    const endRaw =
      typeof appointment.end_time === 'string' ? appointment.end_time.slice(0, 10) : '';
    const lastDay = endRaw && endRaw >= startDay ? endRaw : startDay;
    // Exclusive end, the iCalendar convention.
    return { ...event, full_day: true, start: startDay, end: addDays(lastDay, 1) };
  }
  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const end = typeof appointment.end_time === 'string' ? new Date(appointment.end_time) : null;
  return {
    ...event,
    full_day: false,
    start: start.toISOString(),
    ...(end && !Number.isNaN(end.getTime()) && end > start ? { end: end.toISOString() } : {}),
  };
}

/** Start and end of an event as timestamps, a full-day one at its local midnights. */
function bounds(event) {
  const at = (value) =>
    event.full_day ? new Date(`${value}T00:00:00`).getTime() : new Date(value).getTime();
  const start = at(event.start);
  return { start, end: event.end ? at(event.end) : start };
}

const overlaps = (event, window) => {
  const { start, end } = bounds(event);
  const from = window.from.getTime();
  return start < window.to.getTime() && (end > from || start >= from);
};

/**
 * The requests that publish `events` over `window`: one, or disjoint
 * sub-windows when a range holds more than the core accepts per request. An
 * event straddling a boundary is sent with every sub-window it overlaps.
 */
export function splitWindows(events, window, max = MAX_EVENTS_PER_REQUEST) {
  const inside = events.filter((event) => overlaps(event, window));
  const span = window.to.getTime() - window.from.getTime();
  if (inside.length <= max || span <= 60 * 60 * 1000) {
    return [{ window, events: inside.slice(0, max) }];
  }
  const middle = new Date(window.from.getTime() + Math.floor(span / 2));
  return [
    ...splitWindows(inside, { from: window.from, to: middle }, max),
    ...splitWindows(inside, { from: middle, to: window.to }, max),
  ];
}
