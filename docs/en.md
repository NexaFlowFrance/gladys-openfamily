# OpenFamily

## Overview

[OpenFamily](https://github.com/NexaFlowFrance/OpenFamily) is a free, self-hosted family
organizer: calendar, shopping list, tasks, meals, budget. This integration brings into Gladys what
the household uses every day:

- **The family calendar** becomes a Gladys calendar, kept up to date, shown in the **Calendar**
  view and usable in scenes ("an event of the calendar is coming"). Recurring appointments and
  full-day events are supported, over one month of history and twelve months ahead.
- **Three dashboard widgets**: today's appointments, the shopping list and the tasks. The last
  two have a button to add an entry and a button to check one off.
- **Four scene actions**: add an item to the shopping list, add a task, read the shopping list,
  read the tasks. The last two hand their result to the next actions of the scene (to announce it
  on a speaker, for instance).
- **Three scene triggers**: an item added to the list, a task completed, a task due today.

Gladys never changes the OpenFamily calendar. It only writes to OpenFamily when you add or check
off an item or a task, from a widget or a scene.

## Requirements

- Gladys Assistant 5.2.0 or later.
- An OpenFamily server that Gladys can reach on your network, in a version that offers **API
  tokens** (Settings → API tokens).
- An API token created by a parent account. Choose **Read and write** to add and check off from
  Gladys; a **read-only** token is enough to display.
- For the right times: OpenFamily stores the family's local times. With OpenFamily 2.0 or later,
  the integration reads the family's time zone from OpenFamily itself. With an older server, it
  uses the time zone set in the Gladys settings.

## Configuration

1. In OpenFamily, open **Settings → API tokens**, give it a name ("Gladys"), choose the scope and
   create the token. Copy it right away: it is shown only once.
2. In Gladys, open the integration page and fill in:
   - **OpenFamily address**: the one you open in the browser, for example
     `http://192.168.1.20:3000`. From Gladys, `localhost` means the integration's own container:
     use the IP address or the name of the machine.
   - **API token**: the token you copied, starting with `ofk_`.
3. Click **Test the connection**: the message names the account the token stands for.
4. For the calendar, enable the integration in the **My calendars** block. The "OpenFamily"
   calendar appears, private at first: share it with the household to see it on the dashboard and
   use it in scenes. The calendar is the same for the whole family: **one user only** should enable
   it, or every event shows twice.
5. Add the widgets from the dashboard editor: they are named "OpenFamily: today", "OpenFamily:
   shopping list" and "OpenFamily: tasks".

Optional settings:

- **Refresh interval**: how often OpenFamily is read, five minutes by default. Changes usually
  arrive within seconds, through OpenFamily's real-time channel.
- **Category of added items**: the OpenFamily category given to the items added from Gladys
  ("Autre" by default).
- **Time zone of the family**: only to fill in when the times show shifted with an OpenFamily
  older than 2.0 (see the troubleshooting).

Reminders go through Gladys' native trigger **"An event of the calendar is coming"**, with the
shared OpenFamily calendar: you choose the delay and filter on the name.

## Troubleshooting

- **"The OpenFamily server cannot be reached"**: check the address, with nothing after the port,
  and that it answers from the machine running Gladys. `localhost` does not work (see above).
- **"OpenFamily refused the API token"**: the token was revoked, or the account that created it
  left the family. Create a new one and paste it in the configuration.
- **"This API token is read-only"**: displaying works, but adding and checking off need a **Read
  and write** token.
- **"OpenFamily answered with an error"**: the address is probably not the one of an OpenFamily
  server, or its version is too old for API tokens.
- **Events show twice**: two users enabled the calendar. Disable it for one of them and share the
  remaining one with the household.
- **Times are shifted**: with OpenFamily 2.0 or later, check the family's time zone in
  OpenFamily, under **Settings**, then **Time zone**. With an older server, the time zone is not
  set in the Gladys settings (the integration then runs in UTC), or it differs from the
  family's: set it in Gladys, or fill in **Time zone of the family** in the integration's
  configuration, for example `Europe/Paris`.
- **A button answers that it needs a more recent Gladys**: widget forms exist since Gladys 5.2.
- **The calendar does not update**: use **Sync now** on the integration page, and check that the
  calendar is not switched off in "My calendars".

A problem, an idea: <https://github.com/NexaFlowFrance/gladys-openfamily/issues>.
