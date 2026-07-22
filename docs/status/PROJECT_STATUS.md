# Project Status

## Snapshot

- Date: 2026-07-22
- Current phase: Phase 1 — deterministic runtime
- Phase state: local full Gate passed; publication and remote CI pending
- Branch: `codex/phase-01-deterministic-runtime`
- Baseline: Phase 0 squash commit `4a18436` on `main`
- Current implementation commit: `0471c25`
- Phase 0 delivery: PR #1 merged after all required GitHub checks passed
- Next phase: Phase 2 — terrain core

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.0.0   |
| serverVersion       | 0.0.0   |
| rulesVersion        | 0.1.0   |
| contentVersion      | 0.0.0   |
| saveSchemaVersion   | 0.0.0   |
| replaySchemaVersion | 0.1.0   |
| protocolVersion     | 0.1.0   |

## Phase 1 implementation

- Implemented checked safe-integer fixed-point arithmetic at scale 1000 and deterministic integer trigonometry.
- Implemented functional `xoshiro128**` random state with eight independently derived subsystem streams and unbiased bounded draws.
- Added strict runtime-validated battle command, event, replay, and snapshot contracts.
- Added bounded canonical serialization, logical state hashing, detached snapshots, deterministic reducer execution, and fail-closed replay verification.
- Added a checked-in golden replay and an executable replay runner covering every Phase 1 command and event family.
- Added ADR 0002 and expanded deterministic battle and save/replay architecture documentation.

## Verification

The final pre-commit repository Gate passed on Node.js 24.14.0 and pnpm 10.31.0:

- Frozen install, format, ESLint, strict TypeScript, build, workspace/infrastructure policy, content validation, asset audit, and secret scan: passed.
- Unit and replay tests: 76 passed.
- Deterministic runtime coverage: 99.09% statements / 95.00% branches.
- Protocol coverage: 100% statements / 100% branches.
- Replay runner coverage: 100% statements / 90.90% branches.
- Golden replay: 12 events and final hash `73b0d3c57d06fa99`; repeated execution and root-seed isolation checks passed.
- Official npm high-severity audit: no known vulnerabilities.
- CycloneDX 1.6 SBOM: generated with 225 components.

Docker remains unavailable on this workstation. Phase 0 Build CI already validated the Compose model and successfully started, healthchecked, and stopped PostgreSQL, Redis, and MinIO. Phase 1 does not add container-dependent behavior. Phase 1 completion still requires all applicable GitHub checks to pass and a normal squash merge.

## Known limits

- Phase 1 provides deterministic primitives and a contract/example reducer, not terrain or complete battle rules.
- The 16-hex logical state hash detects drift and corruption but is not an anti-tamper signature; trusted submissions require later server-side replay plus cryptographic integrity controls.
- Durable saves, migrations, cloud synchronization, and recovery orchestration remain Phase 7 work.
- No Cocos, server, worker, or React application is claimed complete.
- No release-quality artwork or audio exists.
- External platform, legal, publishing, and production infrastructure inputs remain blocked as listed in `EXTERNAL_BLOCKERS.md`.
