<div align="center">
  <img src="cover.png" alt="OpenFamily pour Gladys Assistant" width="520">
  <h1>OpenFamily pour Gladys Assistant</h1>
  <p><strong>Le calendrier familial, la liste de courses et les tâches, directement dans votre domotique</strong><br>
  Deux projets open source français, tous deux hébergés à la maison.</p>

🇬🇧 <a href="README.md">English</a> · 🇫🇷 <strong>Français</strong>

[![Release](https://img.shields.io/github/v/release/NexaFlowFrance/gladys-openfamily?color=16a34a&label=version)](https://github.com/NexaFlowFrance/gladys-openfamily/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/NexaFlowFrance/gladys-openfamily/ci.yml?branch=main&label=CI)](https://github.com/NexaFlowFrance/gladys-openfamily/actions/workflows/ci.yml)
[![Gladys Assistant](https://img.shields.io/badge/Gladys%20Assistant-5.2%2B-0ea5e9)](https://gladysassistant.com)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?logo=docker&logoColor=white)](https://github.com/NexaFlowFrance/gladys-openfamily/pkgs/container/gladys-openfamily)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

</div>

---

[OpenFamily](https://github.com/NexaFlowFrance/OpenFamily) est un organisateur familial libre et
auto-hébergé : calendrier, liste de courses, tâches, repas, budget.
[Gladys Assistant](https://gladysassistant.com) est un assistant domotique open source,
respectueux de la vie privée. Cette intégration relie les deux : Gladys s'occupe de la maison,
OpenFamily de la vie de famille qui s'y déroule.

## ✨ Ce que vous obtenez

|                                      |                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 📅 **Calendrier familial**           | Le calendrier d'OpenFamily comme calendrier Gladys, tenu à jour : récurrences et journées entières, un mois d'historique, douze mois à venir |
| 🧩 **Widgets**                       | Les rendez-vous du jour, la liste de courses et les tâches, avec des boutons pour ajouter et pour cocher                                     |
| 🎬 **Actions de scène**              | Ajouter à la liste de courses, ajouter une tâche, lire la liste de courses, lire les tâches                                                  |
| ⚡ **Déclencheurs de scène**         | Article ajouté à la liste, tâche terminée, tâche à faire aujourd'hui                                                                         |
| 🔔 **Rappels**                       | Avec le déclencheur natif de Gladys « un événement du calendrier approche », sur le calendrier OpenFamily partagé                            |
| 🔄 **Temps réel**                    | Un changement fait dans OpenFamily arrive dans Gladys en quelques secondes                                                                   |
| 🔐 **Vos données restent chez vous** | L'intégration ne parle qu'à votre Gladys et à votre serveur OpenFamily. Gladys ne modifie jamais votre calendrier                            |

## 💡 Des idées de scènes

- 🌅 Au réveil de la famille, lire les tâches du jour et les annoncer sur une enceinte.
- 🧈 Un bouton sur le frigo qui ajoute du beurre à la liste de courses.
- 🛒 Un message à la personne qui fait les courses quand un article est ajouté à la liste.
- 🦷 La lumière de l'entrée s'allume un quart d'heure avant le rendez-vous chez le dentiste.
- ✅ Un mot de félicitations quand quelqu'un termine une tâche.

## 🚀 Installation en trois étapes

1. **Dans OpenFamily**, ouvrez **Paramètres**, puis **Jetons d'API**, créez un jeton **Lecture
   et écriture** et copiez-le. Il n'est affiché qu'une fois.
2. **Dans Gladys** (5.2.0 ou plus récent), ouvrez **Intégrations**, cherchez **OpenFamily** dans
   le catalogue et installez-la.
3. **Configurez-la** : l'adresse de votre serveur OpenFamily, le jeton, puis **Tester la
   connexion**.

Activez ensuite le calendrier dans **Mes calendriers** et ajoutez les widgets à votre tableau de
bord.

📖 Guide complet et dépannage : [Français](docs/fr.md) · [English](docs/en.md)

## 🔧 Comment ça marche

```mermaid
flowchart LR
    OF["🏠 OpenFamily<br/>calendrier · courses · tâches"]
    INT["🔌 Cette intégration<br/>un conteneur lancé par Gladys"]
    GL["🤖 Gladys Assistant<br/>calendrier · tableau de bord · scènes"]
    OF -- "API REST et temps réel" --> INT
    INT -- "calendrier, widgets, déclencheurs" --> GL
    GL -- "actions de scène, boutons des widgets" --> INT
    INT -- "ajouter, cocher" --> OF
```

L'intégration tourne dans son propre conteneur isolé, lancé par Gladys. Elle lit l'API REST
d'OpenFamily avec un jeton d'API personnel, régulièrement et dès que le canal temps réel
d'OpenFamily signale un changement. Gladys conserve le jeton comme un secret, et il n'est envoyé
qu'à votre serveur OpenFamily.

## 🧰 Pour les développeurs

La structure du code, les commandes et la procédure de release sont décrites dans le
[README en anglais](README.md#-for-developers).

## 🤝 Vos retours

Un problème, une idée ? Ouvrez une
[issue](https://github.com/NexaFlowFrance/gladys-openfamily/issues), ou venez en parler sur le
[forum de la communauté Gladys](https://community.gladysassistant.com).

## 🙏 Crédits

Construite à partir du
[template JavaScript](https://github.com/GladysAssistant/integration-template-js) et du
[SDK](https://github.com/GladysAssistant/integration-sdk-js) officiels de Gladys Assistant, en
suivant les conseils donnés sur le forum de la communauté Gladys. C'est l'intégration du projet
OpenFamily ; elle ne fait pas partie de Gladys Assistant.

## 📄 Licence

Apache-2.0, voir [LICENSE](LICENSE).
