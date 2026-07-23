# Phase 10 Report: Release Preparation and Operations

## Delivered

- Asset provenance registry v2 and an executable audit for source files, license evidence, commercial/modification rights, SHA-256 identity, reviewer/date, generated-material approval, competitor terms/fingerprints and placeholder exclusion.
- WeChat package analyzer with main/subpackage accounting, internal budgets, source-map/development-file exclusion and a separate requirement for dated current official-limit evidence against a real compiled package.
- Evidence-backed readiness and strict release gates that verify all required categories, external blocker ownership, immutable candidate identity and zero open P0/P1 issues.
- A declared audio catalog covering five music contexts, critical accessible cues, SFX families and explicit missing final asset IDs under `EXT-005`.
- Offline-accessible main-menu routes for the privacy policy and user agreement, plus privacy data, SDK, policy, agreement and legal-review drafts.
- API request IDs, privacy-safe structured completion logs, W3C trace correlation and low-cardinality Prometheus request metrics, with health/readiness and a production alert/runbook contract.
- A guarded PostgreSQL custom-format backup/restore drill that restores only to an isolated `_restore_drill` database, verifies the public table inventory and cleans up. Server Integration CI runs the real drill against PostgreSQL 17.
- Updated device, performance, package, operations, legal, known-issue and external-blocker evidence boundaries.

## Compatibility

| Dimension                             | Change         | Reason                                                                    |
| ------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| `clientVersion`                       | 0.4.0 to 0.5.0 | Adds persistent legal/privacy navigation required for release preparation |
| `serverVersion`                       | 0.3.0 to 0.4.0 | Adds request correlation and Prometheus operational surface               |
| content/rules/protocol/save/replay/AI | unchanged      | No authority, content, save or wire payload incompatibility               |

## Release-gate state

Engineering readiness passes only when its referenced automated checks pass and every blocked item maps to `EXTERNAL_BLOCKERS.md`. The strict gate intentionally remains failing: approved final art/fonts/music/SFX, a real signed WeChat build and current official package evidence, physical-device results, production backup/monitoring evidence, final public name, operating entity/AppID and qualified legal/publishing approvals do not exist in the repository.

An empty `assets/release/` is acceptable for development but cannot satisfy `approved-assets` or `complete-audio`. Synthetic performance tests and the CI restore drill provide engineering evidence but cannot replace physical-device or production recovery evidence.

## Acceptance evidence

- Targeted unit, integration, coverage and strict TypeScript checks cover the new provenance, package, release, database, telemetry and client navigation behavior.
- `pnpm release:check` passes with two engineering gates passed and nine externally blocked gates reported.
- `pnpm release:gate` fails closed before release because the compiled WeChat package and current official limit evidence are absent.
- Full local repository evidence is recorded in `PROJECT_STATUS.md`; 388 tests passed with two PostgreSQL-only local skips, every coverage threshold passed, three Playwright journeys passed, and all deterministic/performance/security/build gates passed.
- GitHub checks, including the real PostgreSQL 17 restore drill, remain mandatory before merge.
