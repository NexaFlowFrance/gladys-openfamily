# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [0.2.0] - 2026-11-15

### Changed

- With OpenFamily 2.0 or later, the integration reads the family's time zone
  from OpenFamily itself: times are right without setting anything, whatever
  the time zone of Gladys. The "Time zone of the family" setting still wins
  when it is filled in, and stays useful with an older server.

## [0.1.1] - 2026-11-15

### Added

- An optional "Time zone of the family" setting, for a Gladys whose time zone
  was never set: its integrations then run in UTC and the times showed shifted.

## [0.1.0] - 2026-11-15

### Added

- The OpenFamily family calendar as a Gladys calendar, for the users who enable
  it: recurring and full-day events, one month of history, twelve months ahead.
- Three dashboard widgets: today's appointments, the shopping list and the
  tasks, with forms to add an entry and to check one off.
- Four scene actions: add to the shopping list, add a task, read the shopping
  list, read the tasks.
- Three scene triggers: item added to the shopping list, task completed, task
  due today.
- Changes arrive within seconds through OpenFamily's real-time channel, with a
  periodic reading as the safety net.

[Unreleased]: https://github.com/NexaFlowFrance/gladys-openfamily/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/NexaFlowFrance/gladys-openfamily/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/NexaFlowFrance/gladys-openfamily/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/NexaFlowFrance/gladys-openfamily/releases/tag/v0.1.0
