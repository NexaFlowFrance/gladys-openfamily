// -----------------------------------------------------------------------------
// Every text the integration shows, in English and French. Gladys picks the
// language of the user.
// -----------------------------------------------------------------------------

import { ERRORS, REASONS } from './openfamily.js';

const plural = (count, one, many) => (count === 1 ? one : many);
// "de Léa", "d'Alex": French elides before a vowel, and before the h of most first names.
const frenchOf = (name) => (/^[aeiouyhàâäéèêëîïôöùûüœ]/i.test(name) ? `d'${name}` : `de ${name}`);

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
    [ERRORS.TOO_OLD]: {
      en: 'This OpenFamily server is too old for API tokens. Update it to version 2.0 or later.',
      fr: "Ce serveur OpenFamily est trop ancien pour les jetons d'API. Mettez-le à jour en version 2.0 ou plus récente.",
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
  // An unreachable server, when the failure says why. Like every error text,
  // at most 200 characters: Gladys cuts the message of a widget button there.
  unreachable: {
    [REASONS.LOOPBACK]: {
      en: 'Seen from Gladys, localhost is the integration itself. Use the address of the machine running OpenFamily on your network, like http://192.168.1.20:3000.',
      fr: "Vu de Gladys, localhost désigne l'intégration elle-même. Utilisez l'adresse de la machine d'OpenFamily sur votre réseau, comme http://192.168.1.20:3000.",
    },
    [REASONS.DNS]: {
      en: 'Gladys cannot find the OpenFamily server under this name. Use its address on your network, like http://192.168.1.20:3000: a Tailscale or .local name may be unknown to Gladys.',
      fr: 'Gladys ne trouve pas le serveur OpenFamily sous ce nom. Utilisez son adresse sur votre réseau, comme http://192.168.1.20:3000 : un nom Tailscale ou .local peut être inconnu de Gladys.',
    },
    [REASONS.REFUSED]: {
      en: 'The OpenFamily server refuses the connection. Check the port in its address, and that OpenFamily is running.',
      fr: "Le serveur OpenFamily refuse la connexion. Vérifiez le port dans son adresse, et qu'OpenFamily est démarré.",
    },
    [REASONS.TIMEOUT]: {
      en: 'The OpenFamily server does not answer. Check its address, and that Gladys can reach it: a VPN address such as a Tailscale one often works from your own devices only.',
      fr: 'Le serveur OpenFamily ne répond pas. Vérifiez son adresse, et que Gladys peut la joindre : une adresse de VPN, comme celle de Tailscale, ne fonctionne souvent que depuis vos appareils.',
    },
    [REASONS.PROTOCOL]: {
      en: 'This address starts with https:// but the server answers in plain HTTP. Write it with http://.',
      fr: 'Cette adresse commence par https:// mais le serveur répond en HTTP simple. Écrivez-la avec http://.',
    },
    [REASONS.CERTIFICATE]: {
      en: 'Gladys does not trust the HTTPS certificate of the OpenFamily server. Use its http:// address on your network, or a certificate from a public authority.',
      fr: "Gladys ne fait pas confiance au certificat HTTPS du serveur OpenFamily. Utilisez son adresse http:// sur votre réseau, ou un certificat d'une autorité publique.",
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
  // A first name, in a widget's settings or a scene action, that is nobody's.
  noMember: (name) => ({
    en: `Nobody in the OpenFamily family is named "${name}". Write the first name as it is in OpenFamily.`,
    fr: `Personne dans la famille OpenFamily ne s'appelle « ${name} ». Écrivez le prénom comme dans OpenFamily.`,
  }),
  // OpenFamily's own names of the meals of the day.
  meal: {
    breakfast: { en: 'Breakfast', fr: 'Petit-déjeuner' },
    lunch: { en: 'Lunch', fr: 'Déjeuner' },
    dinner: { en: 'Dinner', fr: 'Dîner' },
    snack: { en: 'Snack', fr: 'Snack' },
  },
  calendarName: { en: 'OpenFamily', fr: 'OpenFamily' },
  calendarDescription: {
    en: 'The family calendar of OpenFamily',
    fr: "Le calendrier familial d'OpenFamily",
  },
  widget: {
    today: { en: 'Today', fr: "Aujourd'hui" },
    nothingToday: { en: 'Nothing planned today.', fr: "Rien de prévu aujourd'hui." },
    nothingTodayNext: {
      en: 'Nothing planned today. Coming up:',
      fr: "Rien de prévu aujourd'hui. À venir :",
    },
    tomorrowDay: { en: 'Tomorrow', fr: 'Demain' },
    allDay: { en: 'All day', fr: 'Journée' },
    shopping: { en: 'Shopping list', fr: 'Liste de courses' },
    shoppingEmpty: { en: 'The list is empty.', fr: 'La liste est vide.' },
    toBuy: (count) => ({
      en: `${count} ${plural(count, 'item', 'items')} to buy`,
      fr: `${count} ${plural(count, 'article', 'articles')} à acheter`,
    }),
    meals: { en: 'Meals', fr: 'Repas' },
    noMeals: {
      en: 'No meal planned today or tomorrow.',
      fr: "Aucun repas prévu aujourd'hui ni demain.",
    },
    tomorrow: (text) => ({ en: `Tomorrow · ${text.en}`, fr: `Demain · ${text.fr}` }),
    tasks: { en: 'Tasks', fr: 'Tâches' },
    tasksOf: (name) => ({ en: `${name}'s tasks`, fr: `Tâches ${frenchOf(name)}` }),
    tasksEmpty: { en: 'No task to do.', fr: 'Aucune tâche à faire.' },
    tasksEmptyFor: (name) => ({
      en: `No task to do for ${name}.`,
      fr: `Aucune tâche à faire pour ${name}.`,
    }),
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
    due: { en: 'Due', fr: 'Échéance' },
    dueNone: { en: 'No due date', fr: 'Sans échéance' },
    dueToday: { en: 'Today', fr: "Aujourd'hui" },
    dueTomorrow: { en: 'Tomorrow', fr: 'Demain' },
    dueSaturday: { en: 'Saturday', fr: 'Samedi' },
    dueNextWeek: { en: 'In a week', fr: 'Dans une semaine' },
    dueDate: { en: 'Or a date (YYYY-MM-DD)', fr: 'Ou une date (AAAA-MM-JJ)' },
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
export const errorText = (err) =>
  (err?.code === ERRORS.UNREACHABLE && T.unreachable[err.reason]) ||
  T.errors[err?.code] ||
  T.errors[ERRORS.SERVER];
