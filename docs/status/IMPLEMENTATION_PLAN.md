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
| 8     | Daily challenge, attempts, replay worker, anonymous leaderboard         | Complete; PR #9 merged        | Tamper rejection and server-date enforcement                    |
| 9     | Content Studio, gateway, Admin Console, publication and audit           | Local complete; PR/CI pending | UI-authored valid content and traceable admin writes            |
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

Phase 8 met its automated conditions and was squash-merged through PR #9 as `598c8aacd4264ded186e33a8c699738df0a28687` after the required PostgreSQL/Redis integration and all other checks passed.

## Current Phase 9 acceptance

- Main catalogs can be edited with structured fields, undo/redo, draft autosave, import/export and field-specific errors without hand-editing JSON.
- Validation covers schemas, references, localization, maps and deterministic route simulations before packaging.
- Artifacts bind rules/content versions, commit, counts, hashes and simulation evidence and cannot skip the staged, approved, signed and published states.
- Content Gateway is loopback-only, path allow-listed, revision-safe and unable to write unchecked content to production.
- Administrator identity, secret, token audience, session, guard and persistence remain isolated from players; browser tokens are memory-only.
- Every privileged write records actor, target, reason, time and a linked audit hash; risky operations require exact second confirmation.
- Content Studio and Admin Console pass browser E2E against real HTTP boundaries, including invalid-content rejection.
- PostgreSQL migration and adapter coverage remain mandatory in Server Integration CI.
- Full local gates and required GitHub checks must pass before merge.

## Compatibility discipline

Rules, content, save, replay, protocol, client, and server versions remain independent. Phase 1 established `rulesVersion`, `replaySchemaVersion`, and `protocolVersion` at `0.1.0`. Phase 2 advanced only `rulesVersion` to `0.2.0`. Phase 3 advanced `rulesVersion` to `0.3.0` and `protocolVersion` to `0.2.0`. Phase 4 advanced only `rulesVersion` to `0.4.0` and started AI schema `0.1.0`. Phase 5 advanced only `clientVersion` to `0.1.0`. Phase 6 advanced content to `0.1.0`, expedition rules to `0.5.0`, and the PvE client flow to `0.2.0`. Phase 7 advanced client and protocol to `0.3.0` and started save and server schemas at `0.1.0`. Phase 8 advanced client and protocol to `0.4.0`, server to `0.2.0`, and replay schema to `0.2.0`. Phase 9 advances only protocol to `0.5.0` and server to `0.3.0`; player client, content, rules, save, replay and AI versions remain unchanged. Later incompatible changes must increment only affected dimensions and include migrations or compatibility evidence.
