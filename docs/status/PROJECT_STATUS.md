# Project Status

## Snapshot

- Date: 2026-07-23
- Current phase: Phase 11 - V1 release-candidate engineering
- Phase state: local implementation and full regression complete; PR #12 passed all required CI checks
- Branch: `codex/phase-11-v1-release-candidate`
- Baseline: Phase 10 squash commit `57366dd308a8d2e2c3fc3656462ccf87c9a8ce7e` on `main`
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
- Phase 10 delivery: PR #11 merged after all required checks, including the PostgreSQL 17 restore drill, passed
- Phase 11 delivery: PR #12 passed all required checks and was approved for squash merge
- Next phase: V1 external evidence closure; Phase 12 PvP remains blocked by the V1 gate

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.5.0   |
| serverVersion       | 0.4.0   |
| rulesVersion        | 0.6.0   |
| contentVersion      | 0.2.0   |
| saveSchemaVersion   | 0.1.0   |
| replaySchemaVersion | 0.2.0   |
| protocolVersion     | 0.5.0   |
| aiSchemaVersion     | 0.1.0   |

## Phase 11 implementation

- Corrected the authored content inventory to the root V1 minimums and made those counts executable schema gates: 24 battle, 12 engineering and 8 elite maps; 30 events; 8 workshop services; 8 environment mechanics; 20 hidden objectives; and 12 cosmetics.
- Restricted deterministic expedition selection to node-compatible dedicated maps and advanced content/rules to `0.2.0` / `0.6.0`.
- Added a checked-in content freeze lock, immutable publication rollback drill and guards against stale or self-referential rollback.
- Added a serialized legacy-save corpus and migration/resume drill that preserves the prior `0.1.0` content / `0.5.0` rules pair while unknown pairs fail closed.
- Bound the strict release workflow to an RC semantic version and exact commit, and added submission-material, migration, rollback and content-freeze evidence gates.
- Added the V1 Definition of Done audit, recovery-drill record and WeChat submission draft without declaring an actual candidate.

## Verification

Current local evidence on Node.js 24 and pnpm 10:

- Full repository tests pass: 395 passed; two real PostgreSQL adapter tests are skipped locally because Docker is unavailable and remain mandatory with Redis and restore verification in Server Integration CI.
- All package coverage thresholds pass. New/changed controls: save migration 94.38% statements / 90.16% branches / 100% functions / 95.06% lines; release preflight 92.95% / 92.98% / 100% / 96.92%; content schema 93.07% / 85.31% / 100% / 92.52%.
- Determinism gates pass for runtime, terrain, battle, AI, expedition, challenge, save migration and golden replay.
- Performance passes: terrain p95 36.61 ms, AI p95 647.66 ms, 10,000 presentation events in 43.79 ms, 5,000 expedition plans in 468.88 ms, 500 daily definitions in 3,530.49 ms and trusted replay verification p95 14.73 ms.
- Three Playwright control-plane journeys pass.
- `pnpm content:validate` reports exactly 48 maps split 24/12/8, 30 events, 20 hidden objectives, 8 workshop services, 8 environment mechanics and 12 cosmetics.
- Content freeze, save migration and content rollback drills pass. `pnpm release:check` reports six engineering gates passed and nine external gates blocked.
- `pnpm release:gate` fails closed at the release-asset audit as designed; no candidate version or commit has been asserted.
- Format, workspace/infrastructure policy, lint, strict TypeScript, build, static Cocos validation across 37 files, asset audit, source package budget, secret scan, dependency audit and 497-component SBOM pass.

All required GitHub checks, including the PostgreSQL 17 restore drill, passed on PR #12. Neither engineering readiness nor CI is a production-readiness claim.

## Known limits

- `EXT-001` and `EXT-002` block real WeChat login, deployed cloud-save, routed monitoring and production backup/recovery evidence.
- `EXT-003` and `EXT-004` block qualified legal/publishing approval and a final public name.
- `EXT-005` blocks approved final art, fonts, music and SFX; the empty release directory is not a completion claim.
- `EXT-006` and `DEV-002` block a compiled WeChat package, current platform-limit evidence and real-device results.
- Docker remains unavailable locally; Server Integration CI owns the real PostgreSQL migration, Redis queue/adapters and isolated restore drill.
- Internal package budgets are automated; official current limits must be captured from an authoritative source for each immutable candidate.
- No production backend, platform approval, legal sign-off, device result or public-release claim is complete.
