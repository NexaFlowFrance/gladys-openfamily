# OpenFamily

## Présentation

[OpenFamily](https://github.com/NexaFlowFrance/OpenFamily) est un organisateur familial libre et
auto-hébergé : calendrier, liste de courses, tâches, repas, budget. Cette intégration fait entrer
dans Gladys ce qui sert au quotidien dans la maison :

- **Le calendrier familial** devient un calendrier Gladys, tenu à jour, visible dans la vue
  **Calendrier** et utilisable par les scènes (« un événement du calendrier approche »). Les
  rendez-vous récurrents et les journées entières sont pris en charge, sur un mois d'historique et
  douze mois à venir.
- **Trois widgets** de tableau de bord : les rendez-vous du jour, la liste de courses et les
  tâches. Les deux derniers ont un bouton pour ajouter et un bouton pour cocher.
- **Quatre actions de scène** : ajouter un article à la liste de courses, ajouter une tâche, lire
  la liste de courses, lire les tâches. Les deux dernières donnent leur résultat aux actions
  suivantes de la scène (par exemple pour l'annoncer sur une enceinte).
- **Trois déclencheurs de scène** : un article ajouté à la liste, une tâche terminée, une tâche à
  faire aujourd'hui.

Gladys ne modifie jamais le calendrier d'OpenFamily. Elle n'écrit dans OpenFamily que lorsque vous
ajoutez ou cochez un article ou une tâche, depuis un widget ou une scène.

## Prérequis

- Gladys Assistant 5.2.0 ou plus récent.
- Un serveur OpenFamily que Gladys peut joindre sur votre réseau, dans une version qui propose les
  **jetons d'API** (Paramètres → Jetons d'API).
- Un jeton d'API créé par un compte parent. Choisissez **Lecture et écriture** pour pouvoir
  ajouter et cocher depuis Gladys ; un jeton en **lecture seule** suffit pour afficher.
- Le fuseau horaire réglé dans les paramètres de Gladys : OpenFamily enregistre les heures
  locales de la famille, et l'intégration les lit dans le fuseau de Gladys.

## Configuration

1. Dans OpenFamily, ouvrez **Paramètres → Jetons d'API**, donnez un nom (« Gladys »), choisissez
   la portée et créez le jeton. Copiez-le tout de suite : il n'est affiché qu'une fois.
2. Dans Gladys, ouvrez la page de l'intégration et renseignez :
   - **Adresse d'OpenFamily** : celle que vous ouvrez dans le navigateur, par exemple
     `http://192.168.1.20:3000`. Depuis Gladys, `localhost` désigne le conteneur de
     l'intégration : utilisez l'adresse IP ou le nom de la machine.
   - **Jeton d'API** : le jeton copié, qui commence par `ofk_`.
3. Cliquez sur **Tester la connexion** : le message donne le compte que le jeton représente.
4. Pour le calendrier, activez l'intégration dans le bloc **Mes calendriers**. Le calendrier
   « OpenFamily » apparaît, privé au départ : partagez-le avec le foyer pour le voir sur le tableau
   de bord et l'utiliser dans les scènes. Le calendrier est le même pour toute la famille :
   **un seul utilisateur** doit l'activer, sinon chaque événement apparaît en double.
5. Ajoutez les widgets depuis l'édition du tableau de bord : ils s'appellent « OpenFamily :
   aujourd'hui », « OpenFamily : liste de courses » et « OpenFamily : tâches ».

Réglages facultatifs :

- **Intervalle d'actualisation** : fréquence de lecture d'OpenFamily, cinq minutes par défaut. Les
  changements arrivent en général en quelques secondes, par le canal temps réel d'OpenFamily.
- **Catégorie des articles ajoutés** : la catégorie OpenFamily donnée aux articles ajoutés depuis
  Gladys (« Autre » par défaut).
- **Fuseau horaire de la famille** : à renseigner seulement si les heures apparaissent décalées
  (voir le dépannage).

Les rappels passent par le déclencheur natif de Gladys **« Un événement du calendrier approche »**,
avec le calendrier OpenFamily partagé : vous choisissez le délai et filtrez sur le nom.

## Dépannage

- **« Le serveur OpenFamily est injoignable »** : vérifiez l'adresse, sans rien après le port, et
  qu'elle répond depuis la machine de Gladys. `localhost` ne fonctionne pas (voir plus haut).
- **« OpenFamily a refusé le jeton d'API »** : le jeton a été révoqué, ou le compte qui l'a créé a
  quitté la famille. Créez-en un nouveau et collez-le dans la configuration.
- **« Ce jeton d'API est en lecture seule »** : l'affichage fonctionne, mais ajouter et cocher
  demandent un jeton **Lecture et écriture**.
- **« OpenFamily a répondu par une erreur »** : l'adresse n'est sans doute pas celle d'un serveur
  OpenFamily, ou sa version est trop ancienne pour les jetons d'API.
- **Les événements apparaissent en double** : deux utilisateurs ont activé le calendrier.
  Désactivez-le pour l'un des deux et partagez celui qui reste avec le foyer.
- **Les heures sont décalées** : le fuseau horaire n'est pas réglé dans les paramètres de Gladys
  (l'intégration tourne alors en UTC), ou il diffère de celui de la famille. Réglez-le dans
  Gladys, ou renseignez **Fuseau horaire de la famille** dans la configuration de l'intégration,
  par exemple `Europe/Paris`.
- **Un bouton répond qu'il demande une Gladys plus récente** : les formulaires des widgets
  existent depuis Gladys 5.2.
- **Le calendrier ne se met pas à jour** : utilisez **Synchroniser maintenant** sur la page de
  l'intégration, et vérifiez que le calendrier n'est pas désactivé dans « Mes calendriers ».

Un problème, une idée : <https://github.com/NexaFlowFrance/gladys-openfamily/issues>.
