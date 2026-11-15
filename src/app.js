// -----------------------------------------------------------------------------
// The integration itself: reads OpenFamily (periodically, and sooner when its
// real-time channel says something changed), mirrors the family calendar into
// Gladys for the users who enabled it, serves the widgets, runs the scene
// actions and fires the scene triggers.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { createLogger } from '@gladysassistant/integration-sdk';
import { isConfigured, normalizeConfig, normalizeTimeZone } from './config.js';
import { OpenFamilyClient, OpenFamilyError, ERRORS } from './openfamily.js';
import { localDay, naive, splitWindows, syncWindow, toGladysEvent } from './calendar.js';
import {
  WIDGET_ACTIONS,
  itemQuantity,
  messageWidget,
  shoppingWidget,
  tasksWidget,
  todayWidget,
} from './widgets.js';
import { connectLive } from './live.js';
import { T, errorText } from './i18n.js';

const logger = createLogger({ name: 'openfamily' });

export const ACTIONS = { TEST: 'test_connection', SYNC: 'sync_now' };
export const WIDGETS = { TODAY: 'today', SHOPPING: 'shopping', TASKS: 'tasks' };
export const SCENE_ACTIONS = {
  ADD_ITEM: 'add_shopping_item',
  ADD_TASK: 'add_task',
  GET_SHOPPING: 'get_shopping_list',
  GET_TASKS: 'get_tasks',
};
export const SCENE_TRIGGERS = {
  ITEM_ADDED: 'shopping_item_added',
  TASK_COMPLETED: 'task_completed',
  TASK_DUE: 'task_due',
};

const CALENDAR_COLOR = '#16a34a';
const MAX_EVENT_TEXT = 200;
const MAX_OUTPUT_TEXT = 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const bounded = (value, max = MAX_EVENT_TEXT) => String(value ?? '').slice(0, max);
const dueDay = (task) => (typeof task.due_date === 'string' ? task.due_date.slice(0, 10) : '');

/** The items still to buy. */
export const pendingItems = (items) => (items ?? []).filter((item) => !item.is_checked);

/** The tasks still to do, soonest first, undated ones last. */
export function pendingTasks(tasks, today) {
  return (tasks ?? [])
    .filter((task) => !task.is_completed)
    .map((task) => {
      const due = dueDay(task);
      return { id: task.id, title: task.title, due, overdue: Boolean(due) && due < today };
    })
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
}

export class OpenFamilyApp {
  /**
   * @param {object} options
   * @param {import('@gladysassistant/integration-sdk').GladysIntegration} options.gladys
   * @param {typeof fetch} [options.fetchImpl]
   * @param {() => Date} [options.now]
   * @param {typeof WebSocket | null} [options.WebSocketImpl] null: no real-time channel
   * @param {boolean} [options.timers] false: no periodic reading (tests drive it)
   */
  constructor({ gladys, fetchImpl, now, WebSocketImpl, timers = true }) {
    this.gladys = gladys;
    this.fetchImpl = fetchImpl;
    this.now = now ?? (() => new Date());
    this.WebSocketImpl = WebSocketImpl;
    this.timers = timers;
    this.config = normalizeConfig();
    this.client = new OpenFamilyClient({ url: '', token: '' });
    this.running = Promise.resolve();
    this.reset();
  }

  reset() {
    /** @type {Map<string, object> | null} the items to buy at the last reading */
    this.items = null;
    /** @type {Map<string, object> | null} every task at the last reading */
    this.tasks = null;
    // What a scene action of ours wrote: never fired back as a trigger, or a
    // scene bound to that trigger would loop through the integration.
    this.ownItems = new Set();
    this.firedDue = new Set();
    this.calendarHashes = new Map();
    this.signatures = {};
  }

  /** Runs `fn` after whatever is in progress: one reading at a time. */
  exclusive(fn) {
    const run = this.running.then(fn);
    this.running = run.catch(() => {});
    return run;
  }

  // --- Lifecycle ----------------------------------------------------------------

  async start(rawConfig) {
    this.stop();
    this.reset();
    this.config = normalizeConfig(rawConfig);
    this.client = new OpenFamilyClient({ ...this.config, fetchImpl: this.fetchImpl });
    if (!isConfigured(this.config)) {
      await this.status(new OpenFamilyError(ERRORS.NOT_CONFIGURED));
      return;
    }
    await this.adoptTimeZone();
    await this.tick();
    if (this.timers) {
      this.pollTimer = setInterval(() => void this.tick(), this.config.pollMinutes * 60 * 1000);
      this.pollTimer.unref?.();
    }
    if (this.WebSocketImpl !== null) {
      this.stopLive = connectLive({
        url: this.config.url,
        token: this.config.token,
        WebSocketImpl: this.WebSocketImpl,
        onUpdate: (entity) => this.liveUpdate(entity),
      });
    }
  }

  /**
   * OpenFamily's date-times are local to the family: the whole process reads
   * them in the family's zone (calendar, "today", due dates alike). That zone
   * is, in order: the one set in this integration's configuration; the
   * family's own, which OpenFamily 2.0 and later give with the account; and
   * otherwise the one Gladys started this container in, which is UTC when the
   * time zone was never set in the Gladys settings.
   */
  async adoptTimeZone() {
    if (this.config.timeZone) {
      process.env.TZ = this.config.timeZone;
      return;
    }
    try {
      const zone = normalizeTimeZone((await this.client.me())?.timezone);
      if (zone) {
        process.env.TZ = zone;
      }
    } catch {
      // The reading that follows says what is wrong with the connection.
    }
  }

  stop() {
    clearInterval(this.pollTimer);
    clearTimeout(this.liveTimer);
    this.stopLive?.();
    this.stopLive = undefined;
  }

  configUpdated(rawConfig) {
    return this.start(rawConfig);
  }

  /** One full reading; reports the outcome as the connection status. Never throws. */
  async tick() {
    try {
      await this.refresh();
      await this.syncCalendars();
      await this.status();
    } catch (err) {
      logger.warn(`Reading OpenFamily failed: ${err.message}`);
      await this.status(err);
    }
  }

  async status(err) {
    try {
      await this.gladys.setConnectionStatus(!err, err ? errorText(err) : undefined);
    } catch (statusErr) {
      logger.debug(`setConnectionStatus failed: ${statusErr.message}`);
    }
  }

  /** OpenFamily said something changed: read soon, once for a burst of changes. */
  liveUpdate(entity) {
    this.liveAppointments = this.liveAppointments || entity === 'appointments';
    clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(async () => {
      const appointments = this.liveAppointments;
      this.liveAppointments = false;
      try {
        await this.refresh();
        if (appointments) {
          await this.syncCalendars();
          this.nudge(WIDGETS.TODAY);
        }
      } catch (err) {
        logger.debug(`Live reading failed: ${err.message}`);
      }
    }, 1500);
    this.liveTimer.unref?.();
  }

  nudge(widgetKey) {
    try {
      this.gladys.requestWidgetRefresh(widgetKey);
    } catch (err) {
      logger.debug(`Widget refresh failed: ${err.message}`);
    }
  }

  // --- Lists: reading, triggers ----------------------------------------------------

  /** Reads the shopping list and the tasks, fires what changed since the last reading. */
  refresh() {
    return this.exclusive(async () => {
      const [shopping, tasks] = await Promise.all([this.client.shopping(), this.client.tasks()]);
      const events = [...this.shoppingEvents(shopping), ...this.taskEvents(tasks)];
      for (const event of events) {
        try {
          await this.gladys.publishSceneEvent(event.key, event.data);
        } catch (err) {
          logger.warn(`Scene event ${event.key} refused: ${err.message}`);
        }
      }
      this.changed(WIDGETS.SHOPPING, pendingItems(shopping));
      this.changed(WIDGETS.TASKS, pendingTasks(tasks, localDay(this.now())));
    });
  }

  /** Nudges a widget when what it shows is not what it showed at the last reading. */
  changed(widgetKey, shown) {
    const signature = JSON.stringify(shown);
    if (this.signatures[widgetKey] !== undefined && this.signatures[widgetKey] !== signature) {
      this.nudge(widgetKey);
    }
    this.signatures[widgetKey] = signature;
  }

  shoppingEvents(shopping) {
    const current = new Map(pendingItems(shopping).map((item) => [String(item.id), item]));
    const events = [];
    // Nothing fires on the first reading: no transition without a previous one.
    if (this.items) {
      for (const [id, item] of current) {
        if (!this.items.has(id) && !this.ownItems.has(id)) {
          events.push({
            key: SCENE_TRIGGERS.ITEM_ADDED,
            data: {
              item: bounded(item.name),
              quantity: bounded(itemQuantity(item)),
              count: current.size,
            },
          });
        }
      }
    }
    this.items = current;
    this.ownItems.clear();
    return events;
  }

  taskEvents(tasks) {
    const today = localDay(this.now());
    const current = new Map((tasks ?? []).map((task) => [String(task.id), task]));
    const pending = pendingTasks(tasks, today);
    const events = [];
    if (this.tasks) {
      for (const [id, task] of current) {
        const before = this.tasks.get(id);
        if (task.is_completed && before && !before.is_completed) {
          events.push({
            key: SCENE_TRIGGERS.TASK_COMPLETED,
            data: { title: bounded(task.title), count: pending.length },
          });
        }
      }
    }
    // Due today: once per task and per day.
    for (const key of this.firedDue) {
      if (!key.endsWith(`:${today}`)) this.firedDue.delete(key);
    }
    for (const task of pending) {
      const key = `${task.id}:${today}`;
      if (task.due === today && !this.firedDue.has(key)) {
        this.firedDue.add(key);
        events.push({
          key: SCENE_TRIGGERS.TASK_DUE,
          data: { title: bounded(task.title), due: task.due, count: pending.length },
        });
      }
    }
    this.tasks = current;
    return events;
  }

  /** A reading after a write of ours; the write itself already succeeded. */
  async refreshQuietly() {
    try {
      await this.refresh();
    } catch (err) {
      logger.debug(`Reading after a write failed: ${err.message}`);
    }
  }

  // --- Calendar --------------------------------------------------------------------

  /**
   * Mirrors the family calendar into one Gladys calendar per user who enabled
   * the integration. Writes only when the events changed, or once a day: the
   * synchronized range moves with the date.
   */
  syncCalendars({ force = false } = {}) {
    return this.exclusive(async () => {
      const accounts = await this.gladys.getCalendarAccounts();
      const enabled = new Set(accounts.map((account) => account.user.selector));
      for (const user of this.calendarHashes.keys()) {
        if (!enabled.has(user)) this.calendarHashes.delete(user);
      }
      if (accounts.length === 0) {
        return { users: 0, events: 0 };
      }
      const now = this.now();
      const window = syncWindow(now);
      const appointments = await this.client.appointments(naive(window.from), naive(window.to));
      let count = 0;
      for (const { user } of accounts) {
        const selector = user.selector;
        const idFor = (id) => this.gladys.externalId(`${selector}:${id}`);
        const calendarId = idFor('family');
        const events = appointments.map((a) => toGladysEvent(a, idFor)).filter(Boolean);
        count = events.length;
        const hash = createHash('sha1')
          .update(localDay(now) + JSON.stringify(events))
          .digest('hex');
        if (!force && this.calendarHashes.get(selector) === hash) {
          continue;
        }
        const language = user.language === 'fr' ? 'fr' : 'en';
        await this.gladys.publishCalendars(selector, [
          {
            external_id: calendarId,
            name: T.calendarName[language],
            description: T.calendarDescription[language],
            color: CALENDAR_COLOR,
          },
        ]);
        const calendars = await this.gladys.getCalendars(selector);
        const calendar = calendars.find((candidate) => candidate.external_id === calendarId);
        // Switched off by the user: the core emptied it and refuses its events.
        // Switching it back on fires onCalendarAccountUpdated, which forces a sync.
        if (calendar?.sync !== false) {
          for (const part of splitWindows(events, window)) {
            await this.gladys.publishCalendarEvents(calendarId, part.events, {
              from: part.window.from.toISOString(),
              to: part.window.to.toISOString(),
            });
          }
        }
        this.calendarHashes.set(selector, hash);
      }
      return { users: accounts.length, events: count };
    });
  }

  /** A user enabled or disabled the calendar, or flipped one of its toggles. */
  async calendarAccountUpdated(selector) {
    this.calendarHashes.delete(selector);
    if (!isConfigured(this.config)) return;
    try {
      await this.syncCalendars();
    } catch (err) {
      logger.warn(`Calendar synchronization failed: ${err.message}`);
    }
  }

  // --- Configuration screen buttons ---------------------------------------------------

  async action(key) {
    try {
      if (key === ACTIONS.TEST) {
        const me = await this.client.me();
        await this.status();
        return T.connected(bounded(me?.name || me?.email || 'OpenFamily', 60));
      }
      await this.refresh();
      const result = await this.syncCalendars({ force: true });
      await this.status();
      return result.users === 0 ? T.noCalendarUser : T.synced(result.users, result.events);
    } catch (err) {
      await this.status(err);
      throw new Error(errorText(err).en, { cause: err });
    }
  }

  // --- Widgets ---------------------------------------------------------------------

  async widgetGet(key) {
    const headings = {
      [WIDGETS.TODAY]: T.widget.today,
      [WIDGETS.SHOPPING]: T.widget.shopping,
      [WIDGETS.TASKS]: T.widget.tasks,
    };
    try {
      if (key === WIDGETS.SHOPPING) {
        return shoppingWidget(pendingItems(await this.client.shopping()));
      }
      if (key === WIDGETS.TASKS) {
        return tasksWidget(pendingTasks(await this.client.tasks(), localDay(this.now())));
      }
      return todayWidget(await this.todayEvents());
    } catch (err) {
      return messageWidget(headings[key], errorText(err), 60);
    }
  }

  /** Today's appointments as the widget shows them, full-day ones first. */
  async todayEvents() {
    const now = this.now();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const today = localDay(now);
    const appointments = await this.client.appointments(naive(start), naive(end));
    return appointments
      .filter((a) => typeof a.title === 'string' && typeof a.start_time === 'string')
      .map((a) => {
        // Started on an earlier day and still running: shown like a full-day one.
        const timed = !a.is_all_day && a.start_time.slice(0, 10) === today;
        return { name: a.title, time: timed ? a.start_time.slice(11, 16) : null };
      })
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }

  /** A button of a widget was tapped; `values` is the form the user filled. */
  async widgetAction(actionKey, values) {
    // A Gladys older than 5.2 drops the form and relays the tap without values.
    if (!values) {
      return T.widget.needsUpdate;
    }
    try {
      switch (actionKey) {
        case WIDGET_ACTIONS.ADD_ITEM: {
          const name = bounded(String(values.item ?? '').trim());
          await this.addItem(name, values.quantity);
          await this.refreshQuietly();
          return T.widget.itemAdded(name);
        }
        case WIDGET_ACTIONS.CHECK_ITEM: {
          const id = String(values.item ?? '');
          const item = this.items?.get(id);
          await this.client.checkShoppingItem(id);
          await this.refreshQuietly();
          return T.widget.itemChecked(bounded(item?.name ?? '', 60));
        }
        case WIDGET_ACTIONS.ADD_TASK: {
          const due = String(values.due_date ?? '').trim();
          if (due && !DATE.test(due)) {
            return T.widget.badDate;
          }
          const title = bounded(String(values.title ?? '').trim());
          await this.client.addTask({ title, dueDate: due });
          await this.refreshQuietly();
          return T.widget.taskAdded(title);
        }
        case WIDGET_ACTIONS.COMPLETE_TASK: {
          const id = String(values.task ?? '');
          const task = this.tasks?.get(id);
          await this.client.completeTask(id);
          await this.refreshQuietly();
          return T.widget.taskDone(bounded(task?.title ?? '', 60));
        }
        default:
          return undefined;
      }
    } catch (err) {
      // An entry that left the list since the form was drawn.
      return err.code === ERRORS.SERVER ? T.widget.gone : errorText(err);
    }
  }

  addItem(name, quantity) {
    return this.client.addShoppingItem({
      name,
      quantity: typeof quantity === 'string' ? quantity : '',
      category: this.config.shoppingCategory,
    });
  }

  // --- Scene actions -----------------------------------------------------------------

  /** Runs a scene action; an error fails that action only, with a readable reason. */
  async sceneAction(key, fields = {}) {
    try {
      switch (key) {
        case SCENE_ACTIONS.ADD_ITEM: {
          const name = bounded(String(fields.item ?? '').trim());
          if (!name) throw new Error('The item is empty.');
          // Written and marked in one step, so that no reading sees the new
          // item before it is known as ours.
          await this.exclusive(async () => {
            const created = await this.addItem(name, fields.quantity);
            if (created?.id !== undefined) this.ownItems.add(String(created.id));
          });
          await this.refreshQuietly();
          return { item: name, count: this.items?.size ?? 0 };
        }
        case SCENE_ACTIONS.ADD_TASK: {
          const title = bounded(String(fields.title ?? '').trim());
          const due = String(fields.due_date ?? '').trim();
          if (!title) throw new Error('The title is empty.');
          if (due && !DATE.test(due)) throw new Error(T.widget.badDate.en);
          await this.client.addTask({ title, dueDate: due });
          await this.refreshQuietly();
          return { title, count: this.pendingTaskCount() };
        }
        case SCENE_ACTIONS.GET_SHOPPING: {
          const items = pendingItems(await this.client.shopping());
          const names = items.map((item) => {
            const quantity = itemQuantity(item);
            return quantity ? `${item.name} (${quantity})` : item.name;
          });
          return { count: items.length, items: bounded(names.join(', '), MAX_OUTPUT_TEXT) };
        }
        case SCENE_ACTIONS.GET_TASKS: {
          const today = localDay(this.now());
          const tasks = pendingTasks(await this.client.tasks(), today);
          return {
            count: tasks.length,
            due_today: tasks.filter((task) => task.due === today).length,
            list: bounded(tasks.map((task) => task.title).join(', '), MAX_OUTPUT_TEXT),
          };
        }
        default:
          throw new Error(`Unknown scene action ${key}`);
      }
    } catch (err) {
      if (err instanceof OpenFamilyError) {
        throw new Error(errorText(err).en, { cause: err });
      }
      throw err;
    }
  }

  pendingTaskCount() {
    return [...(this.tasks?.values() ?? [])].filter((task) => !task.is_completed).length;
  }
}

/** Registers every handler on the SDK client, before connect(). */
export function registerHandlers(gladys, options = {}) {
  const app = new OpenFamilyApp({ gladys, ...options });

  for (const key of Object.values(ACTIONS)) {
    gladys.onAction(key, () => app.action(key));
  }
  for (const key of Object.values(SCENE_ACTIONS)) {
    gladys.onSceneAction(key, (fields) => app.sceneAction(key, fields));
  }
  for (const key of Object.values(WIDGETS)) {
    gladys.onWidgetGet(key, () => app.widgetGet(key));
    gladys.onWidgetAction(key, (actionKey, _params, context) =>
      app.widgetAction(actionKey, context?.values),
    );
  }
  gladys.onConfigUpdated((config) => app.configUpdated(config));
  gladys.onCalendarAccountUpdated((selector) => app.calendarAccountUpdated(selector));
  gladys.on('connected', async () => {
    try {
      await app.start(await gladys.getConfig());
    } catch (err) {
      logger.error('Start failed', err);
    }
  });
  gladys.on('disconnected', () => app.stop());
  return app;
}
