# V1.0 Definition of Done Audit

Last reviewed on 2026-07-23 for Phase 11 engineering readiness. `passed` below means repository evidence exists and its executable gate passes; it does not replace external release approval.

## Engineering and product

| Requirement                                                                                                      | Evidence                                                                 | State                                  |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| All applications build; core tests, deterministic replay, integration and E2E pass                               | Quality, Build, Determinism, Server Integration, Web E2E workflows       | Passed locally; Phase 11 PR/CI pending |
| Empty database migration and isolated restore                                                                    | Prisma migration plus `pnpm backup:drill` in Server Integration          | Passed in CI                           |
| Content publication, freeze and rollback                                                                         | Content Gateway plus `content:freeze:check` and `content:rollback:drill` | Passed locally                         |
| Save migration and compatible resume                                                                             | Serialized legacy corpus plus `save:migration:drill`                     | Passed locally                         |
| Version compatibility matrix                                                                                     | Product versions and recovery allow-list                                 | Passed                                 |
| Six tutorials, six robots, eighteen modules, four regions and four Bosses                                        | Strict content schema and catalog validation                             | Passed                                 |
| Content scale: 24 battle, 12 engineering, 8 elite, 30 events, 8 workshop, 8 environment, 20 hidden, 12 cosmetics | Content `0.2.0` counts emitted by `pnpm content:validate`                | Passed                                 |
| Ordinary, hard and expert rules; daily fixed seed; anonymous leaderboard                                         | Content/runtime, challenge/server/worker and protocol tests              | Passed                                 |
| Accessibility and offline legal routes                                                                           | Client model and Cocos static tests                                      | Passed                                 |
| No known P0/P1, data-loss or client-authoritative leaderboard defect                                             | Known-issue gate and regression suites                                   | Passed                                 |

## Strict release evidence

| Requirement                                                                          | State                            |
| ------------------------------------------------------------------------------------ | -------------------------------- |
| Approved, original/licensed final art, fonts, music and complete SFX                 | Blocked by `EXT-005`             |
| Compiled package within current official limits and signed device matrix             | Blocked by `EXT-001` / `EXT-006` |
| Production deployment, routed alerts, backup recovery and deletion rehearsal         | Blocked by `EXT-002`             |
| Qualified publishing, filing, anti-addiction, privacy, agreement and rating approval | Blocked by `EXT-003`             |
| Cleared public name                                                                  | Blocked by `EXT-004`             |
| Verified operating entity and WeChat credentials                                     | Blocked by `EXT-001`             |

Therefore the repository can produce and validate a candidate only after the listed external evidence is supplied. No V1.0 RC or public release is currently declared.
