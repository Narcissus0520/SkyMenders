# Implementation Plan

This plan follows the mandatory phase order in `AGENTS.md`. A phase is complete only after its code, tests, documentation, local gates, required CI checks, PR, and permitted merge are complete.

| Phase | Scope                                                                   | State              | Exit evidence                                              |
| ----- | ----------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------- |
| 0     | Governance, monorepo, CI, Compose, docs, legal/asset policy             | In progress        | Install, lint, typecheck, tests, build, validators, CI     |
| 1     | Fixed math, RNG streams, commands/events, snapshots, hashes, replay     | Planned            | Repeatable replays and isolated RNG streams                |
| 2     | Chunk terrain, materials, damage/repair, support, collapse, validation  | Planned            | Replayable collapse, property tests, benchmark             |
| 3     | Turn rules, movement, energy, durability, objectives, 18 modules        | Planned            | Complete module behavior and combination tests             |
| 4     | Behavior trees, utility AI, 8 enemies, elites, 4 bosses                 | Planned            | Legal commands and multi-strategy boss tests               |
| 5     | Cocos client, WeChat adapter, input, camera, UI, audio, accessibility   | Planned            | Device workflow, 30 FPS baseline, non-color cues           |
| 6     | Four-region expedition, rewards, workshop, events, unlocks, 6 tutorials | Planned            | Full-length expedition and content minimums                |
| 7     | Auth adapter, accounts, local/cloud saves, recovery, restart, migration | Planned            | Weak-network recovery and deletion flow                    |
| 8     | Daily challenge, attempts, replay worker, anonymous leaderboard         | Planned            | Tamper rejection and server-date enforcement               |
| 9     | Content Studio, gateway, Admin Console, publication and audit           | Planned            | UI-authored valid content and traceable admin writes       |
| 10    | Approved assets, performance, package budget, operations, legal prep    | Planned            | No placeholders/unlicensed assets or P0/P1 issues          |
| 11    | V1 release candidate, regression, freeze, recovery drills               | Planned            | Full V1 Definition of Done, except explicit external gates |
| 12+   | Server-authoritative real-time PvP                                      | Blocked by V1 gate | PvP gates without breaking V1 replay compatibility         |

## Current Phase 0 acceptance

- Root workspace and version policy are reproducible on Node 24 and pnpm 10.
- Strict TypeScript, linting, formatting, unit tests, coverage, build, secret scanning, content validation, and asset provenance checks execute locally and in CI.
- Docker Compose defines loopback-only development state services and optional observability, with healthchecks and persistent volumes.
- Required status, architecture, legal, security, operations, and testing documents exist and describe real behavior and limits.
- No credential, personal data, unapproved release asset, mock production integration, or undocumented core placeholder is committed.
- Phase branch is published only after all locally available gates pass; CI must be green before normal squash merge.

## Compatibility discipline

Rules, content, save, replay, protocol, client, and server versions remain independent. Phase 0 starts each dimension at `0.0.0`; later incompatible changes must increment the affected dimension and include migrations or compatibility evidence.
