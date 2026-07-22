# Project Status

## Snapshot

- Date: 2026-07-22
- Current phase: Phase 7 - accounts, cloud saves, recovery, restart, and migrations
- Phase state: local full repository gate passed; PR and remote CI pending
- Branch: `codex/phase-07-account-save`
- Baseline: Phase 6 squash commit `e2d90dee36b761bb67e9cb154cb99101f79d83b5` on `main`
- Phase 0 delivery: PR #1 merged after all required checks passed
- Phase 1 delivery: PR #2 merged after all required checks passed
- Phase 2 delivery: PR #3 merged after all required checks passed
- Phase 3 delivery: PR #4 merged after all required checks passed
- Phase 4 delivery: PR #5 merged after all required checks passed
- Phase 5 delivery: PR #6 merged after all required checks passed
- Phase 6 delivery: PR #7 merged after all required checks passed
- Next phase: Phase 8 - daily challenge, authoritative attempts, replay verification, and anonymous leaderboard

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.3.0   |
| serverVersion       | 0.1.0   |
| rulesVersion        | 0.5.0   |
| contentVersion      | 0.1.0   |
| saveSchemaVersion   | 0.1.0   |
| replaySchemaVersion | 0.1.0   |
| protocolVersion     | 0.3.0   |
| aiSchemaVersion     | 0.1.0   |

## Phase 7 implementation

- Added a NestJS 11/Fastify modular-monolith API with bounded requests, security headers, rate limits, stable errors, bearer authorization, OpenAPI, and health endpoints.
- Added server-side WeChat code exchange, HMAC-pseudonymous platform identities, generated public system codes, short access tokens, hashed rotating refresh tokens, logout, and revocation.
- Added Prisma 7/PostgreSQL models and migration for accounts, sessions, profiles, progress, unlocks, achievements, expedition saves, recovery archives, privacy requests, and idempotency records.
- Added profile/settings synchronization, monotonic progress merge, expedition save read/write/delete, atomic compare-and-swap revisions, summary-only conflicts, and explicit conflict resolution.
- Added save schema `0.1.0`, integrity sealing, `0.0.1` migration, turn-to-node-to-expedition recovery, cross-device one-restart enforcement, and version compatibility validation.
- Added client login/session refresh, a checksummed two-slot local journal, offline upload queue, stable idempotency keys, bounded exponential retry, and explicit local/cloud selection.
- Added privacy export and hard account deletion without exposing raw platform identity or token hashes.
- Added a PostgreSQL-backed Server Integration workflow that applies the real migration before HTTP and database integration tests.

## Verification

Current local evidence on Node.js 24 and pnpm 10:

- Full repository tests: 336 passed; one real PostgreSQL adapter test skipped locally because Docker is unavailable and remains mandatory in Server Integration CI.
- Protocol coverage: 98.55% statements / 92.85% branches / 100% functions / 98.52% lines.
- Save migration coverage: 100% statements / 95.65% branches / 100% functions / 100% lines.
- Security coverage: 94.44% statements / 92.59% branches / 100% functions / 94.11% lines.
- Game client coverage: 94.93% statements / 86.33% branches / 91.20% functions / 96.55% lines.
- Game server coverage, excluding generated Prisma output and the CI-integration-tested database adapter: 94.92% statements / 77.85% branches / 98.18% functions / 96.82% lines.
- Concurrent save writes from one base revision yield exactly one success and one `SAVE_CONFLICT`; no expedition body is returned in conflict details.
- Weak-network, interrupted-write, restart, migration, export, deletion, session refresh, and revocation paths passed automated tests.
- Format, workspace/infrastructure policy, lint, strict TypeScript, unit/in-memory integration tests, build, coverage, determinism, performance, content/catalog validation, asset provenance, secret policy, dependency audit, and SBOM all passed.
- Static Cocos check passed across 36 project files. Real Creator and device evidence remains external.

Required GitHub checks, including the PostgreSQL integration job, must pass before Phase 7 is merged. The evidence above is not a production-readiness claim.

## Known limits

- `EXT-001` and `EXT-002` block real WeChat login and deployed cloud-save evidence; local and CI substitutes do not satisfy these external gates.
- `EXT-006` and `DEV-002` block real-device weak-network and resume evidence.
- Docker remains unavailable locally; Server Integration CI owns the real PostgreSQL migration and adapter test.
- Daily attempt authority, replay verification worker, and anonymous leaderboard remain Phase 8.
- Content Studio, Admin Console, publication workflow, production operations, package budgets, approved assets, and release-candidate drills remain later phases.
- No final public name, production backend, platform approval, device result, or public-release claim is complete.
