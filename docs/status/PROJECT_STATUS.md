# Project Status

## Snapshot

- Date: 2026-07-23
- Current phase: Phase 9 - content and administrative control plane
- Phase state: local implementation complete; PR and required CI pending
- Branch: `codex/phase-09-content-tools`
- Baseline: Phase 8 squash commit `598c8aacd4264ded186e33a8c699738df0a28687` on `main`
- Phase 0 delivery: PR #1 merged after all required checks passed
- Phase 1 delivery: PR #2 merged after all required checks passed
- Phase 2 delivery: PR #3 merged after all required checks passed
- Phase 3 delivery: PR #4 merged after all required checks passed
- Phase 4 delivery: PR #5 merged after all required checks passed
- Phase 5 delivery: PR #6 merged after all required checks passed
- Phase 6 delivery: PR #7 merged after all required checks passed
- Phase 7 delivery: PR #8 merged after all required checks, including PostgreSQL integration, passed
- Phase 8 delivery: PR #9 merged after all required checks, including PostgreSQL/Redis integration, passed
- Next phase: Phase 10 - assets, performance, package budget, operations, and legal preparation

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.4.0   |
| serverVersion       | 0.3.0   |
| rulesVersion        | 0.5.0   |
| contentVersion      | 0.1.0   |
| saveSchemaVersion   | 0.1.0   |
| replaySchemaVersion | 0.2.0   |
| protocolVersion     | 0.5.0   |
| aiSchemaVersion     | 0.1.0   |

## Phase 9 implementation

- Added deterministic content parsing, reference/localization/map validation, fixed-seed simulation, hashing, diff, packaging, state transitions and signing.
- Added a loopback-only Content Gateway with allow-listed paths, revision-safe atomic writes, draft autosave, two-person approval, staging, signing, freeze and rollback.
- Added a structured Content Studio for maps, routes, actors/modules, enemy AI, events/tutorials and daily challenge review, including shared deterministic authority inspection.
- Added immutable content manifest/version delivery endpoints.
- Added isolated administrator authentication and a memory-only browser token.
- Added content lifecycle, daily preview, anomaly quarantine, system-code reset request, deletion processing, health, compatibility, audit, announcement and risk-switch control surfaces.
- Added PostgreSQL persistence for admin users/sessions, content versions, announcements, risk switches, operational actions and linked audit hashes.
- Added Playwright E2E for valid authoring/staging, admin confirmation/audit and invalid-content publication blocking.

## Verification

Current local evidence on Node.js 24 and pnpm 10:

- Full repository tests: 368 passed; two real PostgreSQL adapter tests skipped locally because Docker is unavailable and remain mandatory with the Redis queue test in Server Integration CI.
- Protocol coverage: 99.09% statements / 87.50% branches / 100% functions / 99.09% lines.
- Content pipeline coverage: 90.19% statements / 83.87% branches / 100% functions / 93.33% lines.
- Content Gateway coverage: 63.76% statements / 59.18% branches / 59.32% functions / 66.66% lines; browser E2E additionally covers the authoring, staging and invalid-content boundaries.
- Content Studio history coverage: 78.57% statements / 57.14% branches / 100% functions / 100% lines; browser E2E covers structured editing and publication interaction.
- Admin Console session-vault coverage: 100% statements / branches / functions / lines; browser E2E covers isolated login and confirmed privileged writes.
- Challenge authority coverage: 92.37% statements / 80% branches / 100% functions / 96.23% lines.
- Save migration coverage: 100% statements / 95.65% branches / 100% functions / 100% lines.
- Security coverage: 94.44% statements / 92.59% branches / 100% functions / 94.11% lines.
- Game client coverage: 94.93% statements / 86.33% branches / 91.20% functions / 96.55% lines.
- Game server coverage, excluding generated Prisma output and the CI-integration-tested infrastructure adapters: 88.78% statements / 77.25% branches / 88.20% functions / 89.81% lines.
- Worker coverage, excluding the CI-integration-tested Redis adapter: 94% statements / 94.44% branches / 93.33% functions / 95.45% lines.
- Concurrent save writes from one base revision yield exactly one success and one `SAVE_CONFLICT`; no expedition body is returned in conflict details.
- Formal-slot concurrency, server-date isolation, attempt recovery, queue idempotency, score/hash/AI tampering, anonymous pagination/cache, and account-deletion cascades passed automated tests.
- Five hundred challenge definitions completed in 2,274.70 ms; trusted replay verification recorded p95 9.68 ms against a 100 ms gate.
- Three Playwright control-plane journeys passed against real local HTTP services: authoring/staging, isolated administrator confirmation/audit, and invalid-content blocking.
- Format, workspace/infrastructure policy, lint, strict TypeScript, unit/in-memory integration tests, build, coverage, determinism, performance, content/catalog validation, asset provenance, secret policy, dependency audit, and SBOM all passed.
- Static Cocos check passed across 37 project files. Real Creator and device evidence remains external.

Required GitHub checks, including Web E2E and the PostgreSQL/Redis integration job, must pass before Phase 9 is merged. The evidence above is not a production-readiness claim.

## Known limits

- `EXT-001` and `EXT-002` block real WeChat login and deployed cloud-save evidence; local and CI substitutes do not satisfy these external gates.
- `EXT-006` and `DEV-002` block real-device weak-network and resume evidence.
- Docker remains unavailable locally; Server Integration CI owns the real PostgreSQL migration, Redis queue, and adapter tests.
- Production queue sizing, retry/dead-letter monitoring, backup, and recovery evidence remain later release gates.
- Production operations, package budgets, approved final assets, legal approval and release-candidate drills remain later phases.
- No final public name, production backend, platform approval, device result, or public-release claim is complete.
