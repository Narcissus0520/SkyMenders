# Implementation Plan

This plan follows the mandatory phase order in `AGENTS.md`. A phase is complete only after its code, tests, documentation, local gates, required CI checks, PR, and permitted merge are complete.

| Phase | Scope                                                                   | State                         | Exit evidence                                                   |
| ----- | ----------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| 0     | Governance, monorepo, CI, Compose, docs, legal/asset policy             | Complete; PR #1 merged        | Local Gate and all required GitHub checks passed                |
| 1     | Fixed math, RNG streams, commands/events, snapshots, hashes, replay     | Complete; PR #2 merged        | Repeatable replays and isolated RNG streams                     |
| 2     | Chunk terrain, materials, damage/repair, support, collapse, validation  | Complete; PR #3 merged        | Replayable collapse, property tests, benchmark                  |
| 3     | Turn rules, movement, energy, durability, objectives, 18 modules        | Complete; PR #4 merged        | Complete module behavior and combination tests                  |
| 4     | Behavior trees, utility AI, 8 enemies, elites, 4 bosses                 | Complete; PR #5 merged        | Legal commands and multi-strategy boss tests                    |
| 5     | Cocos client, WeChat adapter, input, camera, UI, audio, accessibility   | Complete; PR #6 merged        | Automated gates pass; external device evidence is release-gated |
| 6     | Four-region expedition, rewards, workshop, events, unlocks, 6 tutorials | Complete; PR #7 merged        | Full-length expedition and content minimums                     |
| 7     | Auth adapter, accounts, local/cloud saves, recovery, restart, migration | Complete; PR #8 merged        | Weak-network recovery and deletion flow                         |
| 8     | Daily challenge, attempts, replay worker, anonymous leaderboard         | Local complete; PR/CI pending | Tamper rejection and server-date enforcement                    |
| 9     | Content Studio, gateway, Admin Console, publication and audit           | Planned                       | UI-authored valid content and traceable admin writes            |
| 10    | Approved assets, performance, package budget, operations, legal prep    | Planned                       | No placeholders/unlicensed assets or P0/P1 issues               |
| 11    | V1 release candidate, regression, freeze, recovery drills               | Planned                       | Full V1 Definition of Done, except explicit external gates      |
| 12+   | Server-authoritative real-time PvP                                      | Blocked by V1 gate            | PvP gates without breaking V1 replay compatibility              |

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

Phase 5 met its automated conditions and was squash-merged through PR #6 as `6c1a70304f0c3e8d61d1ffb708ccee7c39a45fcb`. Its real Creator/device evidence remains correctly tracked under `EXT-001` and `EXT-006` and is not misrepresented as complete release evidence.

Phase 6 met its automated conditions and was squash-merged through PR #7 as `e2d90dee36b761bb67e9cb154cb99101f79d83b5`. Approved release assets and final balance evidence remain later release gates.

Phase 7 met its automated conditions and was squash-merged through PR #8 as `cc4a0cb6fac0806c24d0bbc811477b8b4ea3c636`. Its real WeChat login, deployed infrastructure, and device evidence remain correctly tracked external gates.

Phase 8 is locally complete on `codex/phase-08-daily-challenge`. Its PostgreSQL/Redis integration job, PR review, and merge remain required before this phase is marked complete.

## Current Phase 8 acceptance

- The business date, challenge seed, route, squad, loadout, enemies, events, rewards, content version, and rules version are generated and frozen by server authority.
- Practice starts are unlimited and unranked; formal starts atomically consume one of exactly three daily slots and cannot be refreshed with a client clock change.
- Checkpoints and finish/abandon writes are authenticated and idempotent; an interrupted active attempt can resume from its accepted boundary.
- Finish uploads contain commands and hashes, never an authoritative score. API handling only queues verification and never performs replay work inline.
- The Worker regenerates server-owned initial states, replays the shared deterministic rules, compares checkpoints/final hashes, recomputes score, and isolates every mismatch.
- Only verified submissions can create anonymous leaderboard entries; responses expose system codes and original robot avatar IDs without platform identity.
- Leaderboard reads are cursor-paginated and Redis-cached, with cache invalidation after a verified best-score update.
- Concurrency, replay tampering, client-date forgery, identity leakage, recovery, queue idempotency, database migration, and load budgets are covered by automated tests.
- Full local gates and required GitHub checks must pass before merge.

## Compatibility discipline

Rules, content, save, replay, protocol, client, and server versions remain independent. Phase 1 established `rulesVersion`, `replaySchemaVersion`, and `protocolVersion` at `0.1.0`. Phase 2 advanced only `rulesVersion` to `0.2.0`. Phase 3 advanced `rulesVersion` to `0.3.0` and `protocolVersion` to `0.2.0`. Phase 4 advanced only `rulesVersion` to `0.4.0` and started AI schema `0.1.0`. Phase 5 advanced only `clientVersion` to `0.1.0`. Phase 6 advanced content to `0.1.0`, expedition rules to `0.5.0`, and the PvE client flow to `0.2.0`. Phase 7 advanced client and protocol to `0.3.0` and started save and server schemas at `0.1.0`. Phase 8 advances client and protocol to `0.4.0`, server to `0.2.0`, and replay schema to `0.2.0`; content, rules, save, and AI versions remain unchanged. Later incompatible changes must increment only affected dimensions and include migrations or compatibility evidence.
