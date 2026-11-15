# OpenFamily for Gladys Assistant

An [external integration](https://gladysassistant.com) that brings
[OpenFamily](https://github.com/NexaFlowFrance/OpenFamily), the free self-hosted family organizer,
into [Gladys Assistant](https://gladysassistant.com), the privacy-first home assistant. Two French
open-source projects, both running at home: Gladys looks after the house, OpenFamily after the
family life that happens in it.

🇫🇷 [Documentation en français](docs/fr.md) · 🇬🇧 [English documentation](docs/en.md)

## What it does

| In Gladys          | From OpenFamily                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| **Calendar**       | The family calendar as a Gladys calendar: recurring and full-day events, one way, kept up to date |
| **Widgets**        | Today's appointments, the shopping list and the tasks, with buttons to add and check off          |
| **Scene actions**  | Add to the shopping list, add a task, read the shopping list, read the tasks                      |
| **Scene triggers** | Item added to the shopping list, task completed, task due today                                   |

Reminders use Gladys' native trigger "an event of the calendar is coming" on the shared OpenFamily
calendar.

## Install

In Gladys (5.2.0 or later): **Integrations**, find **OpenFamily** in the catalog, install, then
follow the [configuration steps](docs/en.md#configuration). You need the address of your OpenFamily
server and an API token created in OpenFamily under **Settings → API tokens**.

## How it works

The integration runs in its own sandboxed container, started by Gladys. It reads OpenFamily's REST
API with a personal API token, periodically and as soon as OpenFamily's real-time channel reports a
change. The token is stored by Gladys as a secret and sent to your OpenFamily server only.

```
index.js            SDK wiring only
src/app.js          reading loop, calendar mirroring, widget, scene and action handlers
src/openfamily.js   the OpenFamily REST client
src/live.js         OpenFamily's real-time channel (WebSocket)
src/calendar.js     appointments -> Gladys events, sync windows
src/widgets.js      the contents of the three widgets
src/config.js       configuration defaults and normalization
src/i18n.js         every text, in English and French
test/               node --test, against the SDK's fake Gladys and an in-memory OpenFamily
```

## Develop

```bash
npm install
npm test               # unit tests, no network
npm run lint
npm run format:check
```

To run it against a real Gladys outside Docker:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="openfamily" \
LOG_LEVEL=debug \
npm start
```

Releases go through **Actions → Release**: the workflow bumps the version in `package.json` and
in the manifest, rolls the changelog, tags, and builds the `linux/amd64` + `linux/arm64` image.

## Credits

Built on the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js) and
[SDK](https://github.com/GladysAssistant/integration-sdk-js) of Gladys Assistant, following the
guidance given on the Gladys community forum. This is the OpenFamily project's own
integration; it is not part of Gladys Assistant.

## License

Apache-2.0
