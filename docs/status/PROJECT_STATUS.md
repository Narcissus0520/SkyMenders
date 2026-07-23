# Project Status

## Snapshot

- Date: 2026-07-23
- Current phase: Phase 10 - release preparation and operations
- Phase state: local implementation and gates complete; PR and required CI pending
- Branch: `codex/phase-10-release-preparation`
- Baseline: Phase 9 squash commit `e4820770979b4ef218df10d2a9cf856a1ab5ca6f` on `main`
- Phase 0 delivery: PR #1 merged after all required checks passed
- Phase 1 delivery: PR #2 merged after all required checks passed
- Phase 2 delivery: PR #3 merged after all required checks passed
- Phase 3 delivery: PR #4 merged after all required checks passed
- Phase 4 delivery: PR #5 merged after all required checks passed
- Phase 5 delivery: PR #6 merged after all required checks passed
- Phase 6 delivery: PR #7 merged after all required checks passed
- Phase 7 delivery: PR #8 merged after all required checks, including PostgreSQL integration, passed
- Phase 8 delivery: PR #9 merged after all required checks, including PostgreSQL/Redis integration, passed
- Phase 9 delivery: PR #10 merged after all required checks, including PostgreSQL/Redis integration and Web E2E, passed
- Next phase: Phase 11 - release candidate, regression, freeze and recovery drills

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.5.0   |
| serverVersion       | 0.4.0   |
| rulesVersion        | 0.5.0   |
| contentVersion      | 0.1.0   |
| saveSchemaVersion   | 0.1.0   |
| replaySchemaVersion | 0.2.0   |
| protocolVersion     | 0.5.0   |
| aiSchemaVersion     | 0.1.0   |

## Phase 10 implementation

- Added release asset provenance v2 with hash, source, license, reviewer, AI-process and originality enforcement.
- Added source/compiled package partition analysis, internal budgets and a current-official-evidence boundary.
- Added separate engineering readiness and strict release-candidate gates over a versioned evidence manifest.
- Added formal music/SFX requirements, privacy/legal/SDK documents and offline legal/privacy menu routes.
- Added structured request logs, request/trace correlation, Prometheus metrics and production alert/runbook contracts.
- Added a guarded PostgreSQL backup/isolated-restore verifier and mandatory Server Integration CI drill.

## Verification

Current local evidence on Node.js 24 and pnpm 10:

- Full repository tests: 388 passed; two real PostgreSQL adapter tests skipped locally because Docker is unavailable and remain mandatory with the Redis and restore-drill paths in Server Integration CI.
- All package coverage thresholds passed. New controls: asset auditor 98.78% statements / 95.16% branches / 100% functions / 100% lines; package budget 97.56% / 96.36% / 100% / 98.64%; release preflight 92.53% / 91.48% / 100% / 96.72%; database restore logic 98.27% / 93.10% / 100% / 100%; request telemetry 100% statements/functions/lines and 92.30% branches.
- Game client coverage: 95.12% statements / 86.66% branches / 91.75% functions / 96.68% lines. Game server: 89.36% / 77.77% / 88.46% / 90.32%.
- Determinism gates passed for runtime, terrain, battle, AI, expedition, challenge, save migration and golden replay.
- Performance passed: terrain p95 32.76 ms, AI p95 348.23 ms, 10,000 presentation events in 45.97 ms, 500 daily definitions in 2,429.30 ms and trusted replay verification p95 9.83 ms.
- Three Playwright control-plane journeys passed.
- Format, workspace/infrastructure policy, lint, strict TypeScript, build, content/AI validation, static Cocos validation across 37 files, asset audit, source package budget, release readiness, secret scan, dependency audit and 497-component SBOM passed.
- The strict release candidate gate failed closed as designed because the compiled WeChat package and current official platform evidence are absent.

Required GitHub checks, including the PostgreSQL 17 restore drill, must pass before Phase 10 is merged. Neither engineering readiness nor CI is a production-readiness claim.

## Known limits

- `EXT-001` and `EXT-002` block real WeChat login, deployed cloud-save, routed monitoring and production backup/recovery evidence.
- `EXT-003` and `EXT-004` block qualified legal/publishing approval and a final public name.
- `EXT-005` blocks approved final art, fonts, music and SFX; the empty release directory is not a completion claim.
- `EXT-006` and `DEV-002` block a compiled WeChat package, current platform-limit evidence and real-device results.
- Docker remains unavailable locally; Server Integration CI owns the real PostgreSQL migration, Redis queue/adapters and isolated restore drill.
- Internal package budgets are automated; official current limits must be captured from an authoritative source for each immutable candidate.
- No production backend, platform approval, legal sign-off, device result or public-release claim is complete.
