# Implementation Plan

This plan follows the mandatory phase order in `AGENTS.md`. A phase is complete only after its code, tests, documentation, local gates, required CI checks, PR, and permitted merge are complete.

| Phase | Scope                                                                   | State                         | Exit evidence                                              |
| ----- | ----------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| 0     | Governance, monorepo, CI, Compose, docs, legal/asset policy             | Complete; PR #1 merged        | Local Gate and all required GitHub checks passed           |
| 1     | Fixed math, RNG streams, commands/events, snapshots, hashes, replay     | Complete; PR #2 merged        | Repeatable replays and isolated RNG streams                |
| 2     | Chunk terrain, materials, damage/repair, support, collapse, validation  | Local Gate passed; CI pending | Replayable collapse, property tests, benchmark             |
| 3     | Turn rules, movement, energy, durability, objectives, 18 modules        | Planned                       | Complete module behavior and combination tests             |
| 4     | Behavior trees, utility AI, 8 enemies, elites, 4 bosses                 | Planned                       | Legal commands and multi-strategy boss tests               |
| 5     | Cocos client, WeChat adapter, input, camera, UI, audio, accessibility   | Planned                       | Device workflow, 30 FPS baseline, non-color cues           |
| 6     | Four-region expedition, rewards, workshop, events, unlocks, 6 tutorials | Planned                       | Full-length expedition and content minimums                |
| 7     | Auth adapter, accounts, local/cloud saves, recovery, restart, migration | Planned                       | Weak-network recovery and deletion flow                    |
| 8     | Daily challenge, attempts, replay worker, anonymous leaderboard         | Planned                       | Tamper rejection and server-date enforcement               |
| 9     | Content Studio, gateway, Admin Console, publication and audit           | Planned                       | UI-authored valid content and traceable admin writes       |
| 10    | Approved assets, performance, package budget, operations, legal prep    | Planned                       | No placeholders/unlicensed assets or P0/P1 issues          |
| 11    | V1 release candidate, regression, freeze, recovery drills               | Planned                       | Full V1 Definition of Done, except explicit external gates |
| 12+   | Server-authoritative real-time PvP                                      | Blocked by V1 gate            | PvP gates without breaking V1 replay compatibility         |

## Phase 0 acceptance

- Root workspace and version policy are reproducible on Node 24 and pnpm 10.
- Strict TypeScript, linting, formatting, unit tests, coverage, build, secret scanning, content validation, and asset provenance checks execute locally and in CI.
- Docker Compose defines loopback-only development state services and optional observability, with healthchecks and persistent volumes.
- Required status, architecture, legal, security, operations, and testing documents exist and describe real behavior and limits.
- No credential, personal data, unapproved release asset, mock production integration, or undocumented core placeholder is committed.
- Phase branch is published only after all locally available gates pass; CI must be green before normal squash merge.

Phase 0 met these conditions and was squash-merged through PR #1 as `4a18436`.

Phase 1 met these conditions and was squash-merged through PR #2 as `dec0fd6`.

## Current Phase 2 acceptance

- The authority grid uses bounded flat integer storage and fixed 32 by 32 chunks.
- Damage, repair, four material behaviors, dirty seams, anchors, support capacity, and collapse are deterministic and immutable.
- Runtime support recomputation is scoped to dirty connected components; full analysis is explicit and never a per-frame path.
- Map validation rejects invalid spawns, unsupported objectives, missing capabilities, inaccessible areas, detached anchors, unsafe camera bounds, and first-settlement failure.
- Terrain operation logs emit a state hash after every operation.
- Seeded property tests and a 2,200-cell golden collapse repeat identically.
- The large-collapse benchmark remains below the 100 ms p95 authority budget.
- Architecture, ADR, compatibility version, test evidence, and known limits are documented before publication.

## Compatibility discipline

Rules, content, save, replay, protocol, client, and server versions remain independent. Phase 1 established `rulesVersion`, `replaySchemaVersion`, and `protocolVersion` at `0.1.0`. Phase 2 advances only `rulesVersion` to `0.2.0`; all other dimensions remain unchanged. Later incompatible changes must increment only affected dimensions and include migrations or compatibility evidence.
