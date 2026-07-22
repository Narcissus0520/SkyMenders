# Project Status

## Snapshot

- Date: 2026-07-22
- Current phase: Phase 3 — battle rules and modules
- Phase state: local full Gate passed; publication and remote CI pending
- Branch: `codex/phase-03-battle-rules-modules`
- Baseline: Phase 2 squash commit `ef3160a` on `main`
- Phase 0 delivery: PR #1 merged after all required GitHub checks passed
- Phase 1 delivery: PR #2 merged after all required GitHub checks passed
- Phase 2 delivery: PR #3 merged after all required GitHub checks passed
- Next phase: Phase 4 — AI, enemies, elites, and bosses

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.0.0   |
| serverVersion       | 0.0.0   |
| rulesVersion        | 0.3.0   |
| contentVersion      | 0.0.0   |
| saveSchemaVersion   | 0.0.0   |
| replaySchemaVersion | 0.1.0   |
| protocolVersion     | 0.2.0   |

## Phase 3 implementation

- Added `@skymenders/battle-core` with bounded immutable state, explicit four-phase whole-round authority, exactly three player robots, team action completion, movement, wait, critical interaction, and zero-energy push/repair.
- Implemented configurable shared energy, carry-over, bounded wait gain, regeneration, cooldowns, main/auxiliary action rules, runtime command validation, strict events, and a canonical checkpoint after every command.
- Implemented HP plus structural damage, source-specific minor/major faults capped at two with mechanics for all four fault kinds, bubble/stabilizer mitigation, unsupported-entity fall settlement, deterministic disable beacons and safe task-object drops, primary-target loss and full-team defeat, and configurable post-node recovery.
- Implemented primary/secondary/hidden objective progression and outcomes. Module-required objectives bind stable entity IDs to authority coordinates; critical interactions remain free.
- Added all eight main and ten auxiliary modules with complete base mechanics and exactly two mutually exclusive mechanical routes each.
- Connected temporary bridge, foam, and constructed support lifecycles to terrain-core; environment settlement expires effects before support/collapse, cooldown, energy, and objective processing.
- Added deterministic projectile-field transformations and jammer score modifiers for later AI integration.
- Added content validation for missing fallbacks, ambiguous objectives, unequipped requirements, required-module energy deadlocks, and globally unusable loadouts.
- Added ADR 0004, battle architecture, golden replay, 128-seed property testing, route/combination tests, and fail-closed boundary suites.

## Verification

The final pre-commit repository Gate passed on Node.js 24.14.0 and pnpm 10.31.0:

- Frozen install, format, workspace/infrastructure policy, content validation, asset audit, secret scan, ESLint, strict TypeScript, and build: passed.
- Full repository tests: 192 passed.
- Battle tests: 76 passed, including all module routes, authority boundaries, content validation, environment fall settlement, golden replay, and property cases.
- Battle coverage: 96.52% statements / 90.67% branches / 98.04% functions / 98.16% lines.
- Terrain tests: 28 passed; coverage 98.25% statements / 94.96% branches / 100% functions / 98.93% lines.
- Deterministic runtime tests: 35 passed; coverage 99.09% statements / 95.00% branches / 100% functions / 99.06% lines.
- Protocol tests: 27 passed.
- Golden battle final hash: `52314be76f79b183`; all 13 command checkpoints are pinned.
- Determinism policy and all golden/property suites: passed.
- Terrain performance: 2,200 collapse cells, 2,519 inspected cells, 12.74 ms median / 17.33 ms p95 against the 100 ms budget.
- Official npm high-severity audit: no known vulnerabilities.
- CycloneDX 1.6 SBOM: generated with 225 components.

Commit, GitHub CI, PR, and normal squash merge remain required before Phase 3 is complete.

Docker remains unavailable on this workstation. Phase 0 Build CI validated the Compose model and started, healthchecked, and stopped PostgreSQL, Redis, and MinIO. Phase 3 adds no container-dependent behavior.

## Known limits

- AI planning, eight enemy behavior profiles, elite combinations, and four multi-stage bosses are Phase 4 work; current enemy fixtures only exercise the shared command authority.
- Full projectile stepping, aiming preview, rendering, input feedback, accessibility presentation, and device performance are Phase 5 client work.
- Route generation, content batch simulation, expedition rewards, authored mission content, and tutorial content are Phase 6 work.
- Module names and route keys are internal/i18n contracts; they do not claim release-quality art, audio, or final public naming.
- No Cocos, server, worker, React application, or release-quality artwork/audio is claimed complete.
- External platform, legal, publishing, and production infrastructure inputs remain blocked as listed in `EXTERNAL_BLOCKERS.md`.
