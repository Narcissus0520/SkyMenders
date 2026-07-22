# Project Status

## Snapshot

- Date: 2026-07-22
- Current phase: Phase 5 - Cocos client and WeChat presentation shell
- Phase state: local full repository gate passed; publication, remote CI, and external device evidence pending
- Branch: `codex/phase-05-game-client`
- Baseline: Phase 4 squash commit `8b379497372ce5ed6712761c10513cc11d62a1d7` on `main`
- Phase 0 delivery: PR #1 merged after all required checks passed
- Phase 1 delivery: PR #2 merged after all required checks passed
- Phase 2 delivery: PR #3 merged after all required checks passed
- Phase 3 delivery: PR #4 merged after all required checks passed
- Phase 4 delivery: PR #5 merged after all required checks passed
- Next phase: Phase 6 - complete PvE expedition and authored content

## Version matrix

| Dimension           | Version |
| ------------------- | ------- |
| clientVersion       | 0.1.0   |
| serverVersion       | 0.0.0   |
| rulesVersion        | 0.4.0   |
| contentVersion      | 0.0.0   |
| saveSchemaVersion   | 0.0.0   |
| replaySchemaVersion | 0.1.0   |
| protocolVersion     | 0.2.0   |
| aiSchemaVersion     | 0.1.0   |

## Phase 5 implementation

- Added a pinned Cocos Creator 3.8.8 2D landscape project and bootstrap scene. The initial shell is built from localization keys and uses large, high-contrast controls.
- Added mock and WeChat platform adapters for safe area, login-code exchange, storage, connectivity, lifecycle, vibration, and preferred frame rate. The client models no WeChat nickname/avatar or server credential.
- Added `BattleSession` as the only client authority gateway. Player and AI commands pass through the shared protocol and reducer; presentation subscribes to validated events and has no battle-state mutation API.
- Added explicit-confirm integer aiming, precise adjustment, partial trajectory policy, gesture priority, camera arbitration, manual-inspection suppression, and reduced-shake behavior.
- Added settings, immediate local persistence, color-vision presets, high contrast, text scaling, reduced flash/motion/shake, handedness, sensitivities, audio buses, vibration, and 30/60 FPS preference.
- Added redundant color/outline/pattern/icon/text semantics, minimum touch target sizing, bounded audio/effect/presentation pools, procedural robot feedback states, async/offline/error screen state, and frame telemetry.
- Added a static Cocos project/credential gate and an actual Creator CLI wrapper that injects the AppID only into a temporary config, validates landscape output, and cleans up.
- Added ADR 0006, client architecture, WeChat validation instructions, a device matrix, Phase 5 report, tests, coverage budgets, and a presentation benchmark.

## Verification

Component evidence on Node.js 24.14.0 and pnpm 10.31.0:

- Full repository tests: 278 passed.
- Client tests: 19 passed; coverage 95.11% statements / 83.82% branches / 92.30% functions / 96.48% lines.
- Cocos build-tool tests: 12 passed; coverage 96.85% statements / 85.95% branches / 100% functions / 97.38% lines.
- Strict TypeScript and ESLint: passed for both new packages.
- Static Cocos check: passed for the pinned project, landscape package, local feature subpackage, start scene, component linkage, empty committed AppID, and client credential scan.
- Presentation benchmark: 10,000 validated events in 31.98 ms, with the queue bounded to 256 and synthetic 30 FPS telemetry in budget.
- Format, workspace/infrastructure policy, content/catalog validation, asset provenance, secret scanning, strict TypeScript, lint, build, coverage, determinism, all performance gates, dependency audit, and CycloneDX SBOM: passed.
- Real build invocation: correctly exited with blocker code 2 because `COCOS_CREATOR_PATH` is unavailable.

GitHub checks must pass before merge. A real Cocos build, WeChat Developer Tools run, and physical-device 30 FPS evidence remain external acceptance items and are not claimed by the synthetic benchmark.

## Known limits

- `EXT-001`, `EXT-006`, and `DEV-002` prevent real WeChat build/device evidence on this workstation.
- The bootstrap UI and procedural visuals are development presentation, not approved release art or the complete Phase 6 product flow.
- Four-region route generation, encounters, rewards, events, workshop, unlocks, achievements, compendium, and six tutorials remain Phase 6.
- Account/cloud saves, recovery, restart/migrations, daily verification, leaderboard, content/admin applications, and production operations remain later phases.
- Docker is unavailable locally; the unchanged Compose model continues to be exercised by Build CI.
- No release-quality artwork/audio, final public name, production backend, or release claim is complete.
