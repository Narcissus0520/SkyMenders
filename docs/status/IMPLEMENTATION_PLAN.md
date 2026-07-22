# Implementation Plan

This plan follows the mandatory phase order in `AGENTS.md`. A phase is complete only after its code, tests, documentation, local gates, required CI checks, PR, and permitted merge are complete.

| Phase | Scope                                                                   | State                  | Exit evidence                                              |
| ----- | ----------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| 0     | Governance, monorepo, CI, Compose, docs, legal/asset policy             | Complete; PR #1 merged | Local Gate and all required GitHub checks passed           |
| 1     | Fixed math, RNG streams, commands/events, snapshots, hashes, replay     | Complete; PR #2 merged | Repeatable replays and isolated RNG streams                |
| 2     | Chunk terrain, materials, damage/repair, support, collapse, validation  | Complete; PR #3 merged | Replayable collapse, property tests, benchmark             |
| 3     | Turn rules, movement, energy, durability, objectives, 18 modules        | Complete; PR #4 merged | Complete module behavior and combination tests             |
| 4     | Behavior trees, utility AI, 8 enemies, elites, 4 bosses                 | Local Gate; CI pending | Legal commands and multi-strategy boss tests               |
| 5     | Cocos client, WeChat adapter, input, camera, UI, audio, accessibility   | Planned                | Device workflow, 30 FPS baseline, non-color cues           |
| 6     | Four-region expedition, rewards, workshop, events, unlocks, 6 tutorials | Planned                | Full-length expedition and content minimums                |
| 7     | Auth adapter, accounts, local/cloud saves, recovery, restart, migration | Planned                | Weak-network recovery and deletion flow                    |
| 8     | Daily challenge, attempts, replay worker, anonymous leaderboard         | Planned                | Tamper rejection and server-date enforcement               |
| 9     | Content Studio, gateway, Admin Console, publication and audit           | Planned                | UI-authored valid content and traceable admin writes       |
| 10    | Approved assets, performance, package budget, operations, legal prep    | Planned                | No placeholders/unlicensed assets or P0/P1 issues          |
| 11    | V1 release candidate, regression, freeze, recovery drills               | Planned                | Full V1 Definition of Done, except explicit external gates |
| 12+   | Server-authoritative real-time PvP                                      | Blocked by V1 gate     | PvP gates without breaking V1 replay compatibility         |

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

## Current Phase 4 acceptance

- AI reads only confirmed battle and explicit AI authority state; no draft input, wall clock, presentation state, or global randomness enters decisions.
- Every generated and selected AI action is accepted through the same battle reducer as player actions; there is no direct state-mutation path.
- Player and enemy team energy pools are independent and participate in canonical state, validation, wait gains, costs, and settlement.
- Behavior-tree macro goals and all nine required utility dimensions are implemented with bounded, stable candidate selection.
- Normal, hard, and expert vary search, awareness, and seeded aim error without HP/damage multipliers or hidden information.
- All eight required enemy roles have distinct valid loadouts and exercised mechanics.
- All six elite affixes are available only in eight tested whitelist templates and do not apply hidden HP/damage multipliers.
- All four bosses have three deterministic stages, two counter signals per stage, two complete tested solution routes, replay-safe progress, and legal completed-state behavior.
- Golden AI decisions and 48 seeded enemy phases repeat identically while maintaining valid battle and AI state.
- `ai-core` exceeds 85% statement and 80% branch coverage; battle, terrain, and deterministic runtime retain 95%/90% coverage.
- Architecture, ADR, compatibility versions, status, test evidence, and known limits are documented before publication.

## Compatibility discipline

Rules, content, save, replay, protocol, client, and server versions remain independent. Phase 1 established `rulesVersion`, `replaySchemaVersion`, and `protocolVersion` at `0.1.0`. Phase 2 advanced only `rulesVersion` to `0.2.0`. Phase 3 advanced `rulesVersion` to `0.3.0` and `protocolVersion` to `0.2.0`. Phase 4 advances only `rulesVersion` to `0.4.0` and starts the internal AI state schema at `0.1.0`; replay schema and all unrelated product dimensions remain unchanged. Later incompatible changes must increment only affected dimensions and include migrations or compatibility evidence.
