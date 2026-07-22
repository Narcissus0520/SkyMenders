# Project Status

## Snapshot

- Date: 2026-07-22
- Current phase: Phase 6 - complete PvE expedition and authored content
- Phase state: local full repository gate passed; PR and remote CI pending
- Branch: `codex/phase-06-pve-expedition`
- Baseline: Phase 5 squash commit `6c1a70304f0c3e8d61d1ffb708ccee7c39a45fcb` on `main`
- Phase 0 delivery: PR #1 merged after all required checks passed
- Phase 1 delivery: PR #2 merged after all required checks passed
- Phase 2 delivery: PR #3 merged after all required checks passed
- Phase 3 delivery: PR #4 merged after all required checks passed
- Phase 4 delivery: PR #5 merged after all required checks passed
- Phase 5 delivery: PR #6 merged after all eight required checks passed
- Next phase: Phase 7 - accounts, cloud saves, recovery, restart, and migrations

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.2.0   |
| serverVersion       | 0.0.0   |
| rulesVersion        | 0.5.0   |
| contentVersion      | 0.1.0   |
| saveSchemaVersion   | 0.0.0   |
| replaySchemaVersion | 0.1.0   |
| protocolVersion     | 0.2.0   |
| aiSchemaVersion     | 0.1.0   |

## Phase 6 implementation

- Added strict content schemas and pack-wide validation for exact IDs, references, localization, module slots, objective roles, map capabilities, progression prerequisites, version agreement, and authority-code alignment.
- Authored six robots, all eighteen modules and thirty-six routes, eight enemies, four Bosses, eighteen objectives, sixteen maps, four regions, twelve events, forty-six rewards, four workshop services, eighteen achievements, forty compendium entries, and six tutorials.
- Added deterministic four-region route generation with isolated RNG streams, four-to-six candidates per region, two selectable layers, a fixed Boss, route visibility, a guaranteed 35-45 minute target path, and twelve visited nodes in a successful run.
- Added locked three-choice rewards, inventory and reward claims, workshop repair/install/upgrade transactions, bounded events, research unlocks, achievement metrics, compendium discovery, configured recovery, defeat/victory, and one-restart tracking.
- Materialized all authored map templates through `terrain-core` and applied the production pre-battle validation contract.
- Added a Cocos-facing `PveFlowModel`, a local `feature-pve` WeChat subpackage, and content/rules metadata without moving battle authority into presentation code.
- Added ADR 0007 and PvE architecture, design, validation, and phase-report documentation.

## Verification

Current component evidence on Node.js 24.14.0 and pnpm 10.31.0:

- Content validation: passed with 6 robots, 18 modules, 8 enemies, 4 Bosses, 18 objectives, 16 maps, 4 regions, 12 events, 46 rewards, 18 achievements, 40 compendium entries, and 6 tutorials.
- Map validation: all 16 authored templates valid with zero initially unstable cells.
- Full repository tests: 297 passed.
- Content-schema tests: 3 passed; coverage 95.56% statements / 91.22% branches / 100% functions / 95.13% lines.
- Content-runtime tests: 10 passed; coverage 94.70% statements / 87.84% branches / 100% functions / 97.13% lines in the final focused run.
- Content-validator tests: 5 passed; coverage 96.92% statements / 85.71% branches / 95.65% functions / 98.38% lines.
- Client tests: 20 passed with the PvE flow model.
- Deterministic route/reward boundary-seed corpus: passed.
- Duration corpus: all 250 tested seeds expose a complete 12-node path within the configured 35-45 minute target.
- Expedition benchmark: 5,000 plans and 119,964 generated nodes in 161.71 ms in the full performance run, under the 5-second automation budget.
- Format, workspace/infrastructure policy, lint, strict TypeScript, build, coverage, determinism, performance, content/catalog validation, asset provenance, secret policy, dependency audit, and SBOM all passed.
- Static Cocos check: passed across 32 required/project script files with both local subpackages. The real editor build correctly stopped with blocker code 2 because Cocos Creator is unavailable; device evidence remains external.

Required GitHub checks must pass before Phase 6 is merged. The evidence above is not a public-release claim.

## Known limits

- `EXT-001`, `EXT-006`, and `DEV-002` still prevent real WeChat build/device evidence on this workstation.
- Authored content and development presentation are structurally complete for Phase 6 but do not replace approved release artwork/audio or final balance sign-off.
- Account/cloud saves, recovery snapshots, cross-device restart enforcement, and migrations remain Phase 7.
- Daily attempt authority, replay verification worker, and anonymous leaderboard remain Phase 8.
- Content Studio, Admin Console, publication workflow, production operations, package budgets, and release-candidate drills remain later phases.
- Docker remains unavailable locally; Build CI continues to exercise the unchanged Compose model.
- No final public name, production backend, platform approval, or release claim is complete.
