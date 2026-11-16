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
- Un serveur OpenFamily **2.0 ou plus récent**, que Gladys peut joindre sur votre réseau. Les
  **jetons d'API** (Paramètres, puis Jetons d'API) sont arrivés avec la version 2.0.
- Un jeton d'API créé par un compte parent. Choisissez **Lecture et écriture** pour pouvoir
  ajouter et cocher depuis Gladys ; un jeton en **lecture seule** suffit pour afficher.
- Pour des heures justes : OpenFamily enregistre les heures locales de la famille, et
  l'intégration lit le fuseau horaire de la famille dans OpenFamily lui-même.

## Configuration

1. Dans OpenFamily, ouvrez **Paramètres → Jetons d'API**, donnez un nom (« Gladys »), choisissez
   la portée et créez le jeton. Copiez-le tout de suite : il n'est affiché qu'une fois.
2. Dans Gladys, ouvrez la page de l'intégration et renseignez :
   - **Adresse d'OpenFamily** : l'adresse du serveur sur votre réseau, par exemple
     `http://192.168.1.20:3000`, sans rien après le port. C'est Gladys qui doit pouvoir la
     joindre, pas votre navigateur : `localhost` désigne le conteneur de l'intégration, et une
     adresse Tailscale ou un nom en `.local` ne sont souvent connus que de vos propres appareils.
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
- **Heure du déclencheur « Tâche à faire aujourd'hui »** : l'heure à partir de laquelle une tâche
  à faire aujourd'hui lance le déclencheur, 7 h par défaut, à l'heure de la famille. Une scène
  qui annonce les tâches du jour ne parle donc pas à minuit. Le déclencheur part une seule fois
  par tâche ce jour-là, même si Gladys ou l'intégration redémarre entre-temps.
- **Fuseau horaire de la famille** : à laisser vide en général, puisque l'intégration lit le
  fuseau de la famille dans OpenFamily. Renseignez-le seulement pour lire les heures dans un
  autre fuseau.

Les rappels passent par le déclencheur natif de Gladys **« Un événement du calendrier approche »**,
avec le calendrier OpenFamily partagé : vous choisissez le délai et filtrez sur le nom.

## Dépannage

Le message affiché sur la page de l'intégration dit ce qui ne va pas :

- **« Vu de Gladys, localhost désigne l'intégration elle-même »** : remplacez `localhost` par
  l'adresse IP de la machine d'OpenFamily sur votre réseau.
- **« Gladys ne trouve pas le serveur OpenFamily sous ce nom »** : Gladys ne connaît pas ce nom,
  comme souvent un nom Tailscale ou un nom en `.local`. Utilisez l'adresse IP du serveur sur
  votre réseau.
- **« Le serveur OpenFamily ne répond pas »** : la machine de Gladys ne peut pas joindre cette
  adresse. C'est le cas d'une adresse Tailscale (`100.x.x.x`) quand Gladys n'est pas dans ce
  réseau Tailscale, ou d'un pare-feu entre les deux machines.
- **« Le serveur OpenFamily refuse la connexion »** : le port de l'adresse n'est pas le bon, ou
  OpenFamily est arrêté.
- **« Cette adresse commence par https:// mais le serveur répond en HTTP simple »** : écrivez
  l'adresse avec `http://`.
- **« Gladys ne fait pas confiance au certificat HTTPS »** : le certificat est auto-signé ou
  vient d'une autorité privée. Utilisez l'adresse `http://` du serveur sur votre réseau.
- **« Le serveur OpenFamily est injoignable »** : une autre panne de réseau. Vérifiez l'adresse,
  sans rien après le port, et qu'elle répond depuis la machine de Gladys.
- **« Ce serveur OpenFamily est trop ancien pour les jetons d'API »** : mettez OpenFamily à jour
  en version 2.0 ou plus récente.
- **« OpenFamily a refusé le jeton d'API »** : le jeton a été révoqué, ou le compte qui l'a créé a
  quitté la famille. Créez-en un nouveau et collez-le dans la configuration.
- **« Ce jeton d'API est en lecture seule »** : l'affichage fonctionne, mais ajouter et cocher
  demandent un jeton **Lecture et écriture**.
- **« OpenFamily a répondu par une erreur »** : l'adresse n'est sans doute pas celle d'un serveur
  OpenFamily.

Autres cas :

- **Les événements apparaissent en double** : deux utilisateurs ont activé le calendrier.
  Désactivez-le pour l'un des deux et partagez celui qui reste avec le foyer.
- **Les heures sont décalées** : vérifiez le fuseau horaire de la famille dans OpenFamily, sous
  **Paramètres**, puis **Fuseau horaire**. Si **Fuseau horaire de la famille** est renseigné dans
  la configuration de l'intégration, c'est lui qui est utilisé : videz-le.
- **Une scène liée à « Tâche à faire aujourd'hui » ne se lance pas le matin** : le déclencheur
  attend l'heure réglée dans la configuration de l'intégration, 7 h par défaut.
- **Un bouton répond qu'il demande une Gladys plus récente** : les formulaires des widgets
  existent depuis Gladys 5.2.
- **Le calendrier ne se met pas à jour** : utilisez **Synchroniser maintenant** sur la page de
  l'intégration, et vérifiez que le calendrier n'est pas désactivé dans « Mes calendriers ».

Un problème, une idée : <https://github.com/NexaFlowFrance/gladys-openfamily/issues>.
