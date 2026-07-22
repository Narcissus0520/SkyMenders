# Project Status

## Snapshot

- Date: 2026-07-22
- Current phase: Phase 2 — terrain core
- Phase state: local full Gate passed; publication and remote CI pending
- Branch: `codex/phase-02-terrain-core`
- Baseline: Phase 1 squash commit `dec0fd6` on `main`
- Phase 0 delivery: PR #1 merged after all required GitHub checks passed
- Phase 1 delivery: PR #2 merged after all required GitHub checks passed
- Next phase: Phase 3 — battle rules and modules

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.0.0   |
| serverVersion       | 0.0.0   |
| rulesVersion        | 0.2.0   |
| contentVersion      | 0.0.0   |
| saveSchemaVersion   | 0.0.0   |
| replaySchemaVersion | 0.1.0   |
| protocolVersion     | 0.1.0   |

## Phase 2 implementation

- Added `@skymenders/terrain-core` with a bounded flat logical grid, 32 by 32 chunks, immutable state transitions, and strict runtime invariants.
- Added the four required material rule definitions with hardness, repair, support, projectile, collapse, magnetic, energy-release, and accessibility-pattern behavior.
- Implemented deterministic radius damage, compatible repair and energy cost, dirty-chunk seam tracking, fixed anchors, constructed supports, material-weighted support propagation, and local unstable-component detection.
- Implemented deterministic rigid-block collapse with stable ordering, settlement/loss outcomes, material-weighted impact energy, dirty destinations, and canonical event records.
- Added terrain operation logs and per-operation state-hash checkpoints for replay and drift detection.
- Added load-time map validation for spawn/objective/capability/navigation/AI/anchor/camera/first-settlement constraints.
- Added seeded property tests and a 192 by 96 large-collapse golden/benchmark scenario.
- Added ADR 0003 and expanded terrain architecture, test strategy, performance budget, and phase evidence.

## Verification

The final pre-commit repository Gate passed on Node.js 24.14.0 and pnpm 10.31.0:

- Frozen install, format, ESLint, strict TypeScript, build, workspace/infrastructure policy, content validation, asset audit, and secret scan: passed.
- Full repository tests: 104 passed; terrain unit/property/golden tests: 27 passed.
- Terrain coverage: 98.19% statements / 94.86% branches / 100% functions / 98.90% lines.
- Golden damage checkpoint: `3c35bec410593720`.
- Golden final terrain state: `bb473002eac7e50e`.
- Golden collapse events: `5ee339be9f95cdca`.
- Large collapse: 2,200 cells; local support inspection: 2,519 cells across nine chunks.
- Latest performance sample after three warmups and fifteen measured runs: 11.17 ms median / 15.67 ms p95 against a 100 ms budget.
- Official npm high-severity audit: no known vulnerabilities.
- CycloneDX 1.6 SBOM: generated with 225 components.

Commit, GitHub CI, PR, and normal squash merge remain required before Phase 2 is complete.

Docker remains unavailable on this workstation. Phase 0 Build CI validated the Compose model and started, healthchecked, and stopped PostgreSQL, Redis, and MinIO. Phase 2 adds no container-dependent behavior.

## Known limits

- Collapse authority currently uses rigid vertical blocks. Visual tumbling may not alter authoritative destinations, impacts, or hashes.
- Terrain contour generation, rendering, input feedback, accessibility textures, and device performance are Phase 5 client work.
- The material registry defines rules and presentation keys; it does not claim release-quality artwork.
- Map validation provides deterministic structural and navigation checks, not the later template generator, content batch simulator, or complete objective/module solvability proof.
- No Cocos, server, worker, React application, or release-quality artwork/audio is claimed complete.
- External platform, legal, publishing, and production infrastructure inputs remain blocked as listed in `EXTERNAL_BLOCKERS.md`.
