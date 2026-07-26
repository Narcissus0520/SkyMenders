# Project Status

## Snapshot

- Date: 2026-07-26
- Current phase: V1 external-evidence closure before the Phase 12 PvP gate
- Phase state: Phases 0-11 are merged; engineering gates pass and strict external release gates remain blocked
- Branch: `main`
- Baseline: Phase 11 squash commit `d0e8698cd77c12369cf98c5366d6b25980cbd7e8` on `main`
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
- Phase 11 delivery: PR #12 squash-merged as `d0e8698cd77c12369cf98c5366d6b25980cbd7e8` after all required checks passed
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
- Format, workspace/infrastructure policy, lint, strict TypeScript, build, static Cocos validation across 39 files, asset audit, source package budget, secret scan, dependency audit and 497-component SBOM pass.

Additional workstation evidence captured on 2026-07-25:

- Docker Desktop is installed and PostgreSQL 17.5, Redis 8.0.2 and MinIO start
  healthy; all three database migrations apply and the available server
  integration suite passes.
- Cocos Creator 3.8.8 produces a real landscape WeChat Mini Game package using
  a non-production test AppID. The optimized engine-plugin build has 27 files
  and totals 1,876,241 bytes in the generated directory.
- The Cocos build exposed and now verifies three client portability boundaries:
  asset-local TypeScript uses bundler-compatible imports, client-shipped
  validation uses the Zod v3 compatibility surface, and the client imports the
  browser-safe save-migration subpath rather than Node-only drill code.
- Protocol, save migration, client and server regression tests pass after the
  compatibility changes: 94 passed and two server integration cases skipped in
  the unit invocation.
- WeChat Developer Tools login and service access are confirmed. A sandbox test
  project imported the earlier self-contained 6,102,124-byte directory,
  compiled it, and displayed the landscape client in the simulator with no
  runtime errors. Physical desktop
  clicks were verified against the simulator: the Settings entry opens a visible
  route state, the Back control restores the main menu, and Standard Expedition
  now opens a playable deterministic local battle rather than a text-only route
  shell.
- The local battle renders procedural terrain, three player robots, two
  command-driven enemies, an objective, aiming feedback, shared-energy HUD and
  touch controls. A real Developer Tools game-context smoke test consumed energy
  from 12 to 8, advanced terrain revision from 0 to 4, resolved enemy and
  environment phases, and reached `battle_complete` with
  `primary_completed` after the third defended round.
- The private battle touch pass now exposes explicit angle and power decrement
  and increment actions, 66-pixel touch targets around 56-pixel controls,
  immediate press-scale feedback, semantic primary/secondary button colors and
  vibration routed through the existing user setting. The detached 100% scale
  simulator keeps the entire control row clickable at its native 844x390 game
  viewport.
- The battle smoke exposed Cocos' incompatible lowering of array spread over
  `Set`, `Map` and other iterables. Client-shipped core paths now use
  `Array.from`, their 210 focused regression tests pass, and the rebuilt WeChat
  artifact contains no known `concat(new Set(...))` lowering.
- The simulator pass corrected invalid bootstrap scene globals, dynamic UI layer
  assignment, malformed `project.config.json` output from the installed Creator
  template, and battle draw-order conflicts between the background and terrain.
  The build wrapper now emits a deterministic valid local project configuration
  after every build.
- The WeChat build now uses the Cocos engine plugin with a pinned minimal 2D
  module set, exact client protocol entry points and deterministic removal of
  disabled default splash assets. Static validation rejects module, plugin or
  splash drift.
- The optimized engine-plugin directory builds and passes the raw compiled-file
  budget, but the sandbox AppID cannot load the public Cocos plugin in Developer
  Tools. Cocos' 3.8 instructions require an AppID opened by the developer to test
  engine separation, so optimized runtime evidence remains blocked by
  `EXT-001`; the prior self-contained build remains the latest simulator runtime
  evidence.
- No preview, upload, submission, review, or production credential was used.
- `pnpm package:budget` measures the compiled result and passes: the
  1,876,241-byte main package is 11,195 bytes below the 1,887,436-byte internal
  budget.

All required GitHub checks, including the PostgreSQL 17 restore drill, passed on PR #12. Neither engineering readiness nor CI is a production-readiness claim.

## Known limits

- `EXT-001` and `EXT-002` block real WeChat login, deployed cloud-save, routed monitoring and production backup/recovery evidence.
- `EXT-003` and `EXT-004` block qualified legal/publishing approval and a final public name.
- `EXT-005` blocks approved final art, fonts, music and SFX; the empty release directory is not a completion claim.
- `EXT-006` still blocks current platform-limit evidence and real-device
  results; the local compiled package is now available but does not close the
  signed device matrix.
- The playable battle is a private development vertical slice with procedural
  placeholder presentation. It is not evidence that the full V1 client,
  release-quality assets, physical-device coverage or publishing gates are
  complete.
- Local Docker and the state services are available. Production infrastructure
  and recovery evidence remain blocked by `EXT-002`.
- `PKG-001` is closed with generated files below the unchanged internal budget.
  Official plugin-inclusive platform accounting remains under `EXT-006`.
- Internal package budgets are automated; official current limits must be captured from an authoritative source for each immutable candidate.
- No production backend, platform approval, legal sign-off, device result or public-release claim is complete.
