# Implementation Plan

This plan follows the mandatory phase order in `AGENTS.md`. A phase is complete only after its code, tests, documentation, local gates, required CI checks, PR, and permitted merge are complete.

| Phase | Scope                                                                   | State                  | Exit evidence                                              |
| ----- | ----------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| 0     | Governance, monorepo, CI, Compose, docs, legal/asset policy             | Complete; PR #1 merged | Local Gate and all required GitHub checks passed           |
| 1     | Fixed math, RNG streams, commands/events, snapshots, hashes, replay     | Complete; PR #2 merged | Repeatable replays and isolated RNG streams                |
| 2     | Chunk terrain, materials, damage/repair, support, collapse, validation  | Complete; PR #3 merged | Replayable collapse, property tests, benchmark             |
| 3     | Turn rules, movement, energy, durability, objectives, 18 modules        | Local Gate; CI pending | Complete module behavior and combination tests             |
| 4     | Behavior trees, utility AI, 8 enemies, elites, 4 bosses                 | Planned                | Legal commands and multi-strategy boss tests               |
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

## Current Phase 3 acceptance

- Whole-round phases, one action per active robot, movement, waiting, authority-only phase advancement, and environment settlement are deterministic and runtime-validated.
- Shared energy carries over, regenerates within bounds, and never removes movement, critical interaction, basic push, or basic repair fallbacks.
- HP, structural damage, source-specific faults, disable/recovery beacons, task-object drops, team defeat, and node recovery are complete.
- Primary, secondary, hidden, critical-interaction, and module-required objective paths are executable; target identity and coordinates cannot be spoofed.
- All 18 required modules have base mechanics and two mutually exclusive mechanical routes with compatibility validation and no empty resolver path.
- Critical combinations, temporary terrain/support expiry, projectile fields, content deadlocks, command rejection, and malformed-state boundaries have automated coverage.
- Golden checkpoints and 128 seeded whole rounds repeat identically while maintaining state, event, HP/structure, and energy invariants.
- `battle-core`, `terrain-core`, and `deterministic-runtime` exceed 95% statement and 90% branch coverage.
- Architecture, ADR, compatibility versions, status, test evidence, and known limits are documented before publication.

## Compatibility discipline

Rules, content, save, replay, protocol, client, and server versions remain independent. Phase 1 established `rulesVersion`, `replaySchemaVersion`, and `protocolVersion` at `0.1.0`. Phase 2 advanced only `rulesVersion` to `0.2.0`. Phase 3 advances `rulesVersion` to `0.3.0` and `protocolVersion` to `0.2.0`; replay schema and all unrelated dimensions remain unchanged. Later incompatible changes must increment only affected dimensions and include migrations or compatibility evidence.
