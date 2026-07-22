# Project Status

## Snapshot

- Date: 2026-07-22
- Current phase: Phase 0 — governance and infrastructure
- Phase state: local Gate passed; remote CI pending
- Branch: `codex/phase-00-foundation`
- Baseline commit: `3902bb0`
- Current implementation commit: `a4fc113`
- Next phase: Phase 1 — deterministic runtime

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.0.0   |
| serverVersion       | 0.0.0   |
| rulesVersion        | 0.0.0   |
| contentVersion      | 0.0.0   |
| saveSchemaVersion   | 0.0.0   |
| replaySchemaVersion | 0.0.0   |
| protocolVersion     | 0.0.0   |

## Completed in Phase 0

- Established the empty remote repository with `AGENTS.md` as the protected product baseline.
- Created the pnpm/Turborepo/TypeScript monorepo configuration for Node.js 24 LTS.
- Added executable workspace, determinism-boundary, secret, Compose, content, and asset-provenance checks.
- Added versioned content and asset registry foundations.
- Added local PostgreSQL, Redis, MinIO, Prometheus, and Grafana Compose configuration.
- Added CI workflow foundations, contribution/security policy, phase tracking, ADRs, release governance, vulnerability audit, license inventory, and CycloneDX SBOM generation.

## Verification

Local verification at `a4fc113`:

- Frozen lockfile install: passed on Node.js `24.14.0` and pnpm `10.31.0`.
- Formatting, ESLint, strict TypeScript, build, workspace policy, determinism policy, content validation, asset audit, and secret scan: passed.
- Unit tests: 16 passed.
- Coverage: shared types 88.88% statements / 85.71% branches; project guard 98.50% / 89.74%; content validator 100% / 83.33%; asset auditor 100% / 85.71%.
- Official npm vulnerability audit at high severity: no known vulnerabilities.
- CycloneDX 1.6 SBOM: generated with 225 components.

Docker runtime verification is unavailable locally because Docker CLI is not installed and the automated Docker Desktop package installation stalled before producing an installer result. The Build and Infrastructure CI job performs `docker compose config`, starts PostgreSQL, Redis, and MinIO with `--wait`, and tears them down; that evidence is pending the Phase 0 PR.

## Known limits

- No gameplay runtime has been implemented in Phase 0; deterministic runtime begins in Phase 1.
- No Cocos, server, worker, or React applications are claimed complete.
- No release-quality artwork or audio exists.
- External platform, legal, publishing, and production infrastructure inputs remain blocked as listed in `EXTERNAL_BLOCKERS.md`.
