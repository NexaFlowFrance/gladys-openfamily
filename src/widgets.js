// -----------------------------------------------------------------------------
// The contents of the dashboard widgets. Pure: data in, declarative content
// out, rendered by Gladys with its own theme.
//
// A card holds at most four buttons, so a row cannot carry its own checkbox:
// one "Check off" / "Done" button opens a form listing the pending entries,
// next to an "Add" form. Forms behind a button need Gladys 5.2.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { addDays } from './calendar.js';
import { T } from './i18n.js';

export const WIDGET_ACTIONS = {
  ADD_ITEM: 'add_item',
  CHECK_ITEM: 'check_item',
  ADD_TASK: 'add_task',
  COMPLETE_TASK: 'complete_task',
};

/** In the form that adds a task: the choice of no due date. */
export const NO_DUE = 'none';

// A status list shows ten rows at most; the last one counts the rest.
const ROWS = 8;
const DAY_FORMAT = { weekday: 'short', day: 'numeric', month: 'short' };

const cut = (value, max) => {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const same = (text) => ({ en: text, fr: text });

/** A text-only content: the empty and the degraded states. */
export function messageWidget(heading, text, ttl = 120) {
  return {
    ttl_seconds: ttl,
    components: [
      { type: 'text', text: heading, variant: 'heading' },
      { type: 'text', text, variant: 'body' },
    ],
  };
}

function rows(entries, toRow) {
  const shown = entries.length > ROWS ? entries.slice(0, ROWS - 1) : entries;
  const items = shown.map(toRow);
  if (entries.length > shown.length) {
    items.push({
      label: T.widget.more(entries.length - shown.length),
      value: '…',
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  return { type: 'status', items };
}

/** How an item reads in a row or a select: "Milk (2 L)". */
export function itemQuantity(item) {
  const quantity =
    item.quantity === null || item.quantity === undefined ? '' : String(item.quantity);
  return [quantity.replace(/\.0+$/, ''), item.unit].filter(Boolean).join(' ');
}

/**
 * The due dates a tap can pick when adding a task, counted from the family's
 * `today` ('YYYY-MM-DD'): typing a date on a wall tablet is the last resort.
 * Saturday is offered when it is neither today nor tomorrow.
 */
export function dueChoices(today) {
  const [year, month, day] = today.split('-').map(Number);
  const toSaturday = (6 - new Date(year, month - 1, day).getDay() + 7) % 7;
  return [
    { value: NO_DUE, label: T.widget.dueNone },
    { value: today, label: T.widget.dueToday },
    { value: addDays(today, 1), label: T.widget.dueTomorrow },
    ...(toSaturday > 1 ? [{ value: addDays(today, toSaturday), label: T.widget.dueSaturday }] : []),
    { value: addDays(today, 7), label: T.widget.dueNextWeek },
  ];
}

/** When a coming appointment is: "Tomorrow 09:30", "Tue, Nov 17", "mar. 17 nov. 09:30". */
function when(event, today) {
  const [year, month, day] = event.day.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const text = (language) =>
    [
      event.day === addDays(today, 1)
        ? T.widget.tomorrowDay[language]
        : new Intl.DateTimeFormat(language, DAY_FORMAT).format(date),
      event.time,
    ]
      .filter(Boolean)
      .join(' ');
  return { en: cut(text('en'), 40), fr: cut(text('fr'), 40) };
}

/**
 * Today's appointments: `events` are { time: 'HH:MM' | null, name }, in order.
 * On a day with none, the widget shows the next ones instead of an empty
 * card: `upcoming` are { day: 'YYYY-MM-DD', time, name }, counted from `today`.
 */
export function todayWidget(events, { upcoming = [], today = '' } = {}) {
  if (events.length === 0 && upcoming.length > 0) {
    return {
      ttl_seconds: 300,
      components: [
        { type: 'text', text: T.widget.today, variant: 'heading' },
        { type: 'text', text: T.widget.nothingTodayNext, variant: 'caption' },
        {
          type: 'status',
          items: upcoming.slice(0, ROWS).map((event) => ({
            label: cut(event.name, 40),
            value: when(event, today),
            icon: 'calendar',
            color: WIDGET_COLORS.NEUTRAL,
          })),
        },
      ],
    };
  }
  if (events.length === 0) {
    return messageWidget(T.widget.today, T.widget.nothingToday, 300);
  }
  return {
    ttl_seconds: 300,
    components: [
      { type: 'text', text: T.widget.today, variant: 'heading' },
      rows(events, (event) => ({
        label: cut(event.name, 40),
        value: event.time ?? T.widget.allDay,
        icon: 'calendar',
        color: WIDGET_COLORS.PRIMARY,
      })),
    ],
  };
}

/**
 * The items still to buy, with the add and check-off forms. `readOnly`: the
 * API token cannot write, so the widget only shows.
 */
export function shoppingWidget(items, { readOnly = false } = {}) {
  const components = [{ type: 'text', text: T.widget.shopping, variant: 'heading' }];
  if (items.length === 0) {
    components.push({ type: 'text', text: T.widget.shoppingEmpty, variant: 'body' });
  } else {
    components.push({ type: 'text', text: T.widget.toBuy(items.length), variant: 'caption' });
    components.push(
      rows(items, (item) => ({
        label: cut(item.name, 40),
        value: cut(itemQuantity(item), 40) || '-',
        icon: 'shopping-cart',
        color: WIDGET_COLORS.PRIMARY,
      })),
    );
  }
  if (readOnly) {
    return { ttl_seconds: 120, components };
  }
  components.push({
    type: 'button',
    label: T.widget.add,
    icon: 'plus',
    style: 'primary',
    action: {
      key: WIDGET_ACTIONS.ADD_ITEM,
      fields: [
        {
          key: 'item',
          type: 'string',
          required: true,
          label: T.widget.item,
          placeholder: T.widget.itemPlaceholder,
        },
        {
          key: 'quantity',
          type: 'string',
          required: false,
          label: T.widget.quantity,
          placeholder: T.widget.quantityPlaceholder,
        },
      ],
    },
  });
  if (items.length > 0) {
    components.push({
      type: 'button',
      label: T.widget.checkOff,
      icon: 'check',
      action: {
        key: WIDGET_ACTIONS.CHECK_ITEM,
        fields: [
          {
            key: 'item',
            type: 'select',
            required: true,
            label: T.widget.item,
            default: String(items[0].id),
            options: items.slice(0, 50).map((item) => ({
              value: String(item.id),
              label: same(cut([item.name, itemQuantity(item)].filter(Boolean).join(' - '), 40)),
            })),
          },
        ],
      },
    });
  }
  return { ttl_seconds: 120, components };
}

/**
 * Today's and tomorrow's planned meals: each a list of { type, label, name }
 * in the order of the day (see dayMeals).
 */
export function mealsWidget({ today, tomorrow }) {
  if (today.length + tomorrow.length === 0) {
    return messageWidget(T.widget.meals, T.widget.noMeals, 300);
  }
  const kind = (meal) => T.meal[meal.type] ?? same(cut(meal.label, 24) || '-');
  const components = [{ type: 'text', text: T.widget.meals, variant: 'heading' }];
  if (today.length === 0) {
    components.push({ type: 'text', text: T.widget.nothingToday, variant: 'caption' });
  }
  components.push({
    type: 'status',
    items: [
      ...today.map((meal) => ({
        label: cut(meal.name, 40),
        value: kind(meal),
        icon: 'coffee',
        color: WIDGET_COLORS.PRIMARY,
      })),
      ...tomorrow.map((meal) => ({
        label: cut(meal.name, 40),
        value: T.widget.tomorrow(kind(meal)),
        icon: 'coffee',
        color: WIDGET_COLORS.NEUTRAL,
      })),
    ].slice(0, 10),
  });
  return { ttl_seconds: 300, components };
}

/**
 * The tasks still to do, soonest first, with the add and done forms. With a
 * `member`, the widget is that person's: `tasks` are theirs only. `today` is
 * the family's day, which the due dates of the add form are counted from;
 * `readOnly`: the API token cannot write, so the widget only shows.
 */
export function tasksWidget(tasks, { member = null, today = '', readOnly = false } = {}) {
  const name = member ? cut(member.name, 24) : '';
  const heading = member ? T.widget.tasksOf(name) : T.widget.tasks;
  const components = [{ type: 'text', text: heading, variant: 'heading' }];
  if (tasks.length === 0) {
    components.push({
      type: 'text',
      text: member ? T.widget.tasksEmptyFor(name) : T.widget.tasksEmpty,
      variant: 'body',
    });
  } else {
    components.push({ type: 'text', text: T.widget.toDo(tasks.length), variant: 'caption' });
    components.push(
      rows(tasks, (task) => ({
        label: cut(task.title, 40),
        // On the family's widget, a row also says whose task it is.
        value: cut([member ? '' : task.who, task.due].filter(Boolean).join(' · '), 40) || '-',
        icon: 'check-square',
        color: task.overdue ? WIDGET_COLORS.DANGER : WIDGET_COLORS.PRIMARY,
      })),
    );
  }
  if (readOnly) {
    return { ttl_seconds: 120, components };
  }
  components.push({
    type: 'button',
    label: T.widget.add,
    icon: 'plus',
    style: 'primary',
    action: {
      key: WIDGET_ACTIONS.ADD_TASK,
      fields: [
        {
          key: 'title',
          type: 'string',
          required: true,
          label: T.widget.task,
          placeholder: T.widget.taskPlaceholder,
        },
        // Picked in a list; a date typed below wins over it.
        ...(today
          ? [
              {
                key: 'due',
                type: 'select',
                required: false,
                label: T.widget.due,
                default: NO_DUE,
                options: dueChoices(today),
              },
            ]
          : []),
        { key: 'due_date', type: 'string', required: false, label: T.widget.dueDate },
      ],
    },
  });
  if (tasks.length > 0) {
    components.push({
      type: 'button',
      label: T.widget.done,
      icon: 'check',
      action: {
        key: WIDGET_ACTIONS.COMPLETE_TASK,
        fields: [
          {
            key: 'task',
            type: 'select',
            required: true,
            label: T.widget.task,
            default: String(tasks[0].id),
            options: tasks.slice(0, 50).map((task) => ({
              value: String(task.id),
              label: same(cut(task.title, 40)),
            })),
          },
        ],
      },
    });
  }
  return { ttl_seconds: 120, components };
}
