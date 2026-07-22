# Project Status

## Snapshot

- Date: 2026-07-22
- Current phase: Phase 8 - daily challenge and anonymous leaderboard
- Phase state: local implementation complete; PR and required CI pending
- Branch: `codex/phase-08-daily-challenge`
- Baseline: Phase 7 squash commit `cc4a0cb6fac0806c24d0bbc811477b8b4ea3c636` on `main`
- Phase 0 delivery: PR #1 merged after all required checks passed
- Phase 1 delivery: PR #2 merged after all required checks passed
- Phase 2 delivery: PR #3 merged after all required checks passed
- Phase 3 delivery: PR #4 merged after all required checks passed
- Phase 4 delivery: PR #5 merged after all required checks passed
- Phase 5 delivery: PR #6 merged after all required checks passed
- Phase 6 delivery: PR #7 merged after all required checks passed
- Phase 7 delivery: PR #8 merged after all required checks, including PostgreSQL integration, passed
- Next phase: Phase 9 - Content Studio, Content Gateway, Admin Console, publication, and audit

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.4.0   |
| serverVersion       | 0.2.0   |
| rulesVersion        | 0.5.0   |
| contentVersion      | 0.1.0   |
| saveSchemaVersion   | 0.1.0   |
| replaySchemaVersion | 0.2.0   |
| protocolVersion     | 0.4.0   |
| aiSchemaVersion     | 0.1.0   |

## Phase 8 implementation

- Added server-business-date challenge generation with secret-derived seeds and fixed squad, loadout, resources, route, maps, opponents, events, rewards, difficulty, and compatibility versions.
- Added unlimited unranked practice, exactly three atomically allocated formal daily slots, idempotent lifecycle writes, abandon consumption, and checkpoint recovery.
- Added strict daily/replay/leaderboard protocol contracts and a client API that never submits a date or treats a claimed score as authoritative.
- Added PostgreSQL persistence for challenge definitions, attempts, replay submissions, anonymous leaderboard entries, and replay risk events.
- Added Redis-backed BullMQ verification delivery and cursor-page leaderboard caching while retaining PostgreSQL as the durable authority.
- Added a separate Worker that regenerates initial states and enemy AI commands, executes the shared deterministic rules, verifies hashes/outcome, and recomputes the 40/20/15/10/10/5 score.
- Added ranked-write isolation so only verified formal submissions can publish, with best-score ordering and privacy-minimal public fields.
- Added dependency-aware API/Worker readiness and PostgreSQL/Redis integration coverage in the required Server Integration workflow.

## Verification

Current local evidence on Node.js 24 and pnpm 10:

- Full repository tests: 354 passed; one real PostgreSQL adapter test skipped locally because Docker is unavailable and remains mandatory with the Redis queue test in Server Integration CI.
- Protocol coverage: 98.94% statements / 92.85% branches / 100% functions / 98.93% lines.
- Challenge authority coverage: 92.37% statements / 80% branches / 100% functions / 96.23% lines.
- Save migration coverage: 100% statements / 95.65% branches / 100% functions / 100% lines.
- Security coverage: 94.44% statements / 92.59% branches / 100% functions / 94.11% lines.
- Game client coverage: 94.93% statements / 86.33% branches / 91.20% functions / 96.55% lines.
- Game server coverage, excluding generated Prisma output and the CI-integration-tested infrastructure adapters: 94.87% statements / 81.13% branches / 96.72% functions / 94.76% lines.
- Worker coverage, excluding the CI-integration-tested Redis adapter: 94% statements / 94.44% branches / 93.33% functions / 95.45% lines.
- Concurrent save writes from one base revision yield exactly one success and one `SAVE_CONFLICT`; no expedition body is returned in conflict details.
- Formal-slot concurrency, server-date isolation, attempt recovery, queue idempotency, score/hash/AI tampering, anonymous pagination/cache, and account-deletion cascades passed automated tests.
- Five hundred challenge definitions completed in 2,415.59 ms; trusted replay verification recorded p95 10.62 ms against a 100 ms gate.
- Format, workspace/infrastructure policy, lint, strict TypeScript, unit/in-memory integration tests, build, coverage, determinism, performance, content/catalog validation, asset provenance, secret policy, dependency audit, and SBOM all passed.
- Static Cocos check passed across 36 project files. Real Creator and device evidence remains external.

Required GitHub checks, including the PostgreSQL/Redis integration job, must pass before Phase 8 is merged. The evidence above is not a production-readiness claim.

## Known limits

- `EXT-001` and `EXT-002` block real WeChat login and deployed cloud-save evidence; local and CI substitutes do not satisfy these external gates.
- `EXT-006` and `DEV-002` block real-device weak-network and resume evidence.
- Docker remains unavailable locally; Server Integration CI owns the real PostgreSQL migration, Redis queue, and adapter tests.
- Production queue sizing, retry/dead-letter monitoring, backup, and recovery evidence remain later release gates.
- Content Studio, Admin Console, publication workflow, production operations, package budgets, approved assets, and release-candidate drills remain later phases.
- No final public name, production backend, platform approval, device result, or public-release claim is complete.
