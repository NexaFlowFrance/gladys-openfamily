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

This is the official OpenFamily integration, built and maintained by
[NexaFlow](https://nexaflow.fr), the team behind OpenFamily.

## Requirements

- Gladys Assistant 5.2.0 or later.
- An OpenFamily server in version **2.0 or later**, that Gladys can reach on your network. **API
  tokens** (Settings, then API tokens) came with version 2.0.
- An API token created by a parent account. Choose **Read and write** to add and check off from
  Gladys; a **read-only** token is enough to display.
- For the right times: OpenFamily stores the family's local times, and the integration reads the
  family's time zone from OpenFamily itself.

## Configuration

1. In OpenFamily, open **Settings → API tokens**, give it a name ("Gladys"), choose the scope and
   create the token. Copy it right away: it is shown only once.
2. In Gladys, open the integration page and fill in:
   - **OpenFamily address**: the address of the server on your network, for example
     `http://192.168.1.20:3000`, with nothing after the port. Gladys is the one that has to reach
     it, not your browser: `localhost` means the integration's own container, and a Tailscale
     address or a `.local` name is often known to your own devices only.
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
- **Hour of the "Task due today" trigger**: the hour from which a task due today fires the
  trigger, 7 by default, in the family's time. A scene that announces the day's tasks does not
  speak at midnight. The trigger fires once per task on that day, even when Gladys or the
  integration restarts in between.
- **Time zone of the family**: usually left empty, since the integration reads the family's time
  zone from OpenFamily. Fill it in only to read the times in another zone.

Reminders go through Gladys' native trigger **"An event of the calendar is coming"**, with the
shared OpenFamily calendar: you choose the delay and filter on the name.

## Troubleshooting

The message shown on the integration page says what is wrong:

- **"Seen from Gladys, localhost is the integration itself"**: replace `localhost` with the IP
  address of the machine running OpenFamily on your network.
- **"Gladys cannot find the OpenFamily server under this name"**: Gladys does not know this name,
  as often with a Tailscale name or a `.local` name. Use the IP address of the server on your
  network.
- **"The OpenFamily server does not answer"**: the machine running Gladys cannot reach this
  address. That is the case of a Tailscale address (`100.x.x.x`) when Gladys is not part of that
  Tailscale network, or of a firewall between the two machines.
- **"The OpenFamily server refuses the connection"**: the port in the address is not the right
  one, or OpenFamily is stopped.
- **"This address starts with https:// but the server answers in plain HTTP"**: write the address
  with `http://`.
- **"Gladys does not trust the HTTPS certificate"**: the certificate is self-signed or comes from
  a private authority. Use the `http://` address of the server on your network.
- **"The OpenFamily server cannot be reached"**: another network failure. Check the address, with
  nothing after the port, and that it answers from the machine running Gladys.
- **"This OpenFamily server is too old for API tokens"**: update OpenFamily to version 2.0 or
  later.
- **"OpenFamily refused the API token"**: the token was revoked, or the account that created it
  left the family. Create a new one and paste it in the configuration.
- **"This API token is read-only"**: displaying works, but adding and checking off need a **Read
  and write** token.
- **"OpenFamily answered with an error"**: the address is probably not the one of an OpenFamily
  server.

Other cases:

- **Events show twice**: two users enabled the calendar. Disable it for one of them and share the
  remaining one with the household.
- **Times are shifted**: check the family's time zone in OpenFamily, under **Settings**, then
  **Time zone**. If **Time zone of the family** is filled in the integration's configuration, it
  is the one used: empty it.
- **A scene bound to "Task due today" does not start in the morning**: the trigger waits for the
  hour set in the integration's configuration, 7 by default.
- **A button answers that it needs a more recent Gladys**: widget forms exist since Gladys 5.2.
- **The calendar does not update**: use **Sync now** on the integration page, and check that the
  calendar is not switched off in "My calendars".

A problem, an idea: <https://github.com/NexaFlowFrance/gladys-openfamily/issues>.
