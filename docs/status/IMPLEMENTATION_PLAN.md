# Implementation Plan

This plan follows the mandatory phase order in `AGENTS.md`. A phase is complete only after its code, tests, documentation, local gates, required CI checks, PR, and permitted merge are complete.

| Phase | Scope                                                                   | State                                                  | Exit evidence                                               |
| ----- | ----------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| 0     | Governance, monorepo, CI, Compose, docs, legal/asset policy             | Complete; PR #1 merged                                 | Local Gate and all required GitHub checks passed            |
| 1     | Fixed math, RNG streams, commands/events, snapshots, hashes, replay     | Complete; PR #2 merged                                 | Repeatable replays and isolated RNG streams                 |
| 2     | Chunk terrain, materials, damage/repair, support, collapse, validation  | Complete; PR #3 merged                                 | Replayable collapse, property tests, benchmark              |
| 3     | Turn rules, movement, energy, durability, objectives, 18 modules        | Complete; PR #4 merged                                 | Complete module behavior and combination tests              |
| 4     | Behavior trees, utility AI, 8 enemies, elites, 4 bosses                 | Complete; PR #5 merged                                 | Legal commands and multi-strategy boss tests                |
| 5     | Cocos client, WeChat adapter, input, camera, UI, audio, accessibility   | Engineering complete; external device evidence pending | Automated gates and non-color cues pass; EXT-001/006 remain |
| 6     | Four-region expedition, rewards, workshop, events, unlocks, 6 tutorials | Planned                                                | Full-length expedition and content minimums                 |
| 7     | Auth adapter, accounts, local/cloud saves, recovery, restart, migration | Planned                                                | Weak-network recovery and deletion flow                     |
| 8     | Daily challenge, attempts, replay worker, anonymous leaderboard         | Planned                                                | Tamper rejection and server-date enforcement                |
| 9     | Content Studio, gateway, Admin Console, publication and audit           | Planned                                                | UI-authored valid content and traceable admin writes        |
| 10    | Approved assets, performance, package budget, operations, legal prep    | Planned                                                | No placeholders/unlicensed assets or P0/P1 issues           |
| 11    | V1 release candidate, regression, freeze, recovery drills               | Planned                                                | Full V1 Definition of Done, except explicit external gates  |
| 12+   | Server-authoritative real-time PvP                                      | Blocked by V1 gate                                     | PvP gates without breaking V1 replay compatibility          |

## Phase 0 acceptance

- Root workspace and version policy are reproducible on Node 24 and pnpm 10.
- Strict TypeScript, linting, formatting, unit tests, coverage, build, secret scanning, content validation, and asset provenance checks execute locally and in CI.
- Docker Compose defines loopback-only development state services and optional observability, with healthchecks and persistent volumes.
- Required status, architecture, legal, security, operations, and testing documents exist and describe real behavior and limits.
- No credential, personal data, unapproved release asset, mock production integration, or undocumented core placeholder is committed.
- Phase branch is published only after all locally available gates pass; CI must be green before normal squash merge.

Phase 0 met these conditions and was squash-merged through PR #1 as `4a18436`.

Phase 1 met these conditions and was squash-merged through PR #2 as `dec0fd6`.

Phase 2 met these conditions and was squash-merged through PR #3 as `ef3160a`.

Phase 3 met these conditions and was squash-merged through PR #4 as `60bbc54`.

Phase 4 met these conditions and was squash-merged through PR #5 as `8b379497372ce5ed6712761c10513cc11d62a1d7`.

## Current Phase 5 acceptance

- Cocos Creator is pinned to 3.8.8 with a validated 2D landscape project, bootstrap scene, and WeChat package configuration.
- All player and AI battle changes flow through protocol validation and the shared reducer; scene, HUD, animation, and event presentation cannot mutate authority state.
- Touch aim quantizes authoritative fields and requires explicit confirmation after release; camera and gesture priority are deterministic.
- Mock and WeChat adapters cover lifecycle, connectivity, storage, safe area, login-code exchange, vibration, and frame-rate preferences without modeling personal profiles or client secrets.
- Accessibility uses redundant text/icon/outline/pattern semantics and first-version settings cover visual, motion, control, audio, and vibration needs.
- Audio, effect, debris, presentation, and frame telemetry pools are bounded; routine synthetic presentation work stays below its automation budget.
- Static project and credential validation, unit coverage, strict type checking, linting, and the full repository gate must pass before publication.
- A real Creator build, WeChat Developer Tools import, low-end sustained 30 FPS, and the physical device matrix require EXT-001 and EXT-006 and are not satisfied by automation.

## Compatibility discipline

Rules, content, save, replay, protocol, client, and server versions remain independent. Phase 1 established `rulesVersion`, `replaySchemaVersion`, and `protocolVersion` at `0.1.0`. Phase 2 advanced only `rulesVersion` to `0.2.0`. Phase 3 advanced `rulesVersion` to `0.3.0` and `protocolVersion` to `0.2.0`. Phase 4 advanced only `rulesVersion` to `0.4.0` and started AI schema `0.1.0`. Phase 5 advances only `clientVersion` to `0.1.0`. Later incompatible changes must increment only affected dimensions and include migrations or compatibility evidence.
