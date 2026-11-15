// -----------------------------------------------------------------------------
// Every text the integration shows, in English and French. Gladys picks the
// language of the user.
// -----------------------------------------------------------------------------

import { ERRORS } from './openfamily.js';

const plural = (count, one, many) => (count === 1 ? one : many);

export const T = {
  errors: {
    [ERRORS.NOT_CONFIGURED]: {
      en: 'Enter the OpenFamily address and an API token in the integration settings.',
      fr: "Renseignez l'adresse d'OpenFamily et un jeton d'API dans les réglages de l'intégration.",
    },
    [ERRORS.UNREACHABLE]: {
      en: 'The OpenFamily server cannot be reached. Check its address and that it is running.',
      fr: "Le serveur OpenFamily est injoignable. Vérifiez son adresse et qu'il est démarré.",
    },
    [ERRORS.UNAUTHORIZED]: {
      en: 'OpenFamily refused the API token. It may have been revoked: create a new one.',
      fr: "OpenFamily a refusé le jeton d'API. Il a peut-être été révoqué : créez-en un nouveau.",
    },
    [ERRORS.READ_ONLY]: {
      en: 'This API token is read-only. Create a "Read and write" token in OpenFamily.',
      fr: "Ce jeton d'API est en lecture seule. Créez un jeton « Lecture et écriture » dans OpenFamily.",
    },
    [ERRORS.FORBIDDEN]: {
      en: 'OpenFamily refused this request for the API token.',
      fr: "OpenFamily a refusé cette requête pour le jeton d'API.",
    },
    [ERRORS.SERVER]: {
      en: 'OpenFamily answered with an error. Check that the address is the one of an OpenFamily server.',
      fr: "OpenFamily a répondu par une erreur. Vérifiez que l'adresse est bien celle d'un serveur OpenFamily.",
    },
  },
  connected: (name) => ({
    en: `Connected to OpenFamily as ${name}.`,
    fr: `Connecté à OpenFamily en tant que ${name}.`,
  }),
  synced: (users, events) => ({
    en: `Calendar synchronized: ${events} ${plural(events, 'event', 'events')} for ${users} ${plural(users, 'user', 'users')}.`,
    fr: `Calendrier synchronisé : ${events} ${plural(events, 'événement', 'événements')} pour ${users} ${plural(users, 'utilisateur', 'utilisateurs')}.`,
  }),
  noCalendarUser: {
    en: 'No user enabled the calendar yet: enable it in "My calendars" below.',
    fr: "Aucun utilisateur n'a encore activé le calendrier : activez-le dans « Mes calendriers » ci-dessous.",
  },
  calendarName: { en: 'OpenFamily', fr: 'OpenFamily' },
  calendarDescription: {
    en: 'The family calendar of OpenFamily',
    fr: "Le calendrier familial d'OpenFamily",
  },
  widget: {
    today: { en: 'Today', fr: "Aujourd'hui" },
    nothingToday: { en: 'Nothing planned today.', fr: "Rien de prévu aujourd'hui." },
    allDay: { en: 'All day', fr: 'Journée' },
    shopping: { en: 'Shopping list', fr: 'Liste de courses' },
    shoppingEmpty: { en: 'The list is empty.', fr: 'La liste est vide.' },
    toBuy: (count) => ({
      en: `${count} ${plural(count, 'item', 'items')} to buy`,
      fr: `${count} ${plural(count, 'article', 'articles')} à acheter`,
    }),
    tasks: { en: 'Tasks', fr: 'Tâches' },
    tasksEmpty: { en: 'No task to do.', fr: 'Aucune tâche à faire.' },
    toDo: (count) => ({
      en: `${count} ${plural(count, 'task', 'tasks')} to do`,
      fr: `${count} ${plural(count, 'tâche', 'tâches')} à faire`,
    }),
    more: (count) => ({ en: `and ${count} more`, fr: `et ${count} de plus` }),
    add: { en: 'Add', fr: 'Ajouter' },
    checkOff: { en: 'Check off', fr: 'Cocher' },
    done: { en: 'Done', fr: 'Terminer' },
    item: { en: 'Item', fr: 'Article' },
    itemPlaceholder: { en: 'Milk', fr: 'Lait' },
    quantity: { en: 'Quantity', fr: 'Quantité' },
    quantityPlaceholder: { en: '2 L', fr: '2 L' },
    task: { en: 'Task', fr: 'Tâche' },
    taskPlaceholder: { en: 'Take out the trash', fr: 'Sortir les poubelles' },
    dueDate: { en: 'Due date (YYYY-MM-DD)', fr: 'Échéance (AAAA-MM-JJ)' },
    needsUpdate: {
      en: 'This button needs a more recent Gladys.',
      fr: 'Ce bouton demande une version plus récente de Gladys.',
    },
    itemAdded: (name) => ({ en: `${name} added to the list`, fr: `${name} ajouté à la liste` }),
    itemChecked: (name) => ({ en: `${name} checked off`, fr: `${name} coché` }),
    taskAdded: (name) => ({ en: `Task added: ${name}`, fr: `Tâche ajoutée : ${name}` }),
    taskDone: (name) => ({ en: `Task done: ${name}`, fr: `Tâche terminée : ${name}` }),
    gone: {
      en: 'It is no longer in the list.',
      fr: "Il n'est plus dans la liste.",
    },
    badDate: {
      en: 'The due date must be written YYYY-MM-DD.',
      fr: "L'échéance doit être écrite AAAA-MM-JJ.",
    },
  },
};

/** The user-facing text of an error thrown by the OpenFamily client, or a generic one. */
export const errorText = (err) => T.errors[err?.code] ?? T.errors[ERRORS.SERVER];
