# Phase 11 Report: V1.0 Release Candidate Engineering

## Delivered

- Corrected and enforced the root V1 content minimums with dedicated encounter templates and content `0.2.0`.
- Type-safe deterministic map selection under rules `0.6.0`, retaining explicit support for the prior `0.1.0` / `0.5.0` save pair.
- Deterministic content freeze hashes, serialized save-migration corpus, isolated content rollback/freeze drill, and stronger active-publication rollback guards.
- Candidate identity binding between the evidence manifest and the exact workflow version/commit.
- WeChat submission draft, recovery-drill record, V1 Definition of Done audit, and updated release evidence.

## Release status

Engineering controls can prepare and verify a candidate, but no RC is declared. The strict gate remains blocked by final approved media/audio, a compiled WeChat package and real-device report, production credentials and recovery evidence, qualified legal/publishing approval, public-name clearance, and verified operating identity (`EXT-001` through `EXT-006`).

## Verification

- 395 repository tests passed locally; the two PostgreSQL adapter tests skipped without Docker remain mandatory in Server Integration CI.
- All coverage thresholds, deterministic replay suites and performance budgets passed. The expanded expedition generator produced 5,000 plans in 468.88 ms.
- Content validation passed with 48 maps split 24 battle / 12 engineering / 8 elite / 4 Boss, plus 30 events, 20 hidden objectives, 8 workshop services, 8 environment mechanics and 12 cosmetics.
- Content freeze, save migration and content rollback/freeze drills passed. Engineering release readiness reported six passed and nine externally blocked gates.
- Format, workspace and infrastructure policy, lint, strict TypeScript, build, static Cocos validation, three Playwright journeys, asset/source-package audits, secret scan, dependency audit and 497-component SBOM passed.
- The strict release gate rejected the empty final-asset inventory as designed. PR #12 passed every required GitHub check, including both quality platforms, Server Integration, Web E2E, Determinism, Build, validation, supply-chain and CodeQL gates.
- Delivery: PR #12 was squash-merged to `main` as `d0e8698cd77c12369cf98c5366d6b25980cbd7e8`.
