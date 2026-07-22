# Phase 03: Battle rules and modules

## Phase goal

Deliver the complete deterministic PvE battle rule layer required before AI and client integration: three-robot whole-round actions, movement, shared energy, cooldowns, HP, structural damage, objectives, all 18 launch modules, and two mutually exclusive gameplay-changing routes per module.

The result is product authority code, not a rendering demo. It runs without Cocos and emits strict commands, effects, events, and canonical state checkpoints that the later client, replay worker, AI, and PvP server can share.

## Main implementation

- Added `@skymenders/battle-core` with bounded immutable state and an exhaustive reducer.
- Implemented explicit `player_planning -> player_action -> enemy_action -> environment_settlement` sequencing. Only `system` may advance phases, and every active actor on the current team must finish.
- Implemented one move per actor, one main module per actor, explicit auxiliary limits, wait, critical interaction, zero-energy push, and zero-energy repair.
- Implemented configurable team energy with maximum 12, regeneration 6, carry-over, bounded wait gain, module costs, cooldowns, fault penalties, and fail-closed affordability checks.
- Implemented HP and structural damage, 30/60 fault thresholds, mechanics for all source-specific faults, a maximum of two faults, bubble/stabilizer mitigation, unsupported actor/object fall settlement, disable beacons, deterministic task-object drops, primary-target loss and team defeat, and 15%/35% configurable post-node recovery.
- Implemented primary, secondary, and hidden objective progress/failure/outcome logic. Module-required tasks use an authority-verified stable target ID plus integer coordinates; critical task interactions remain free.
- Implemented all eight main modules and ten auxiliary modules, including their base behavior and 36 route definitions. Every route declares mechanism, condition, and tradeoff keys and changes targeting, range, duration, material, field behavior, energy exchange, information, or safety.
- Added deterministic projectile-field interaction for gravity, wind, rail, reflector, rebound bubble, and conductive bridge, plus jammer score modification for Phase 4 AI.
- Added temporary support-root add/remove APIs to terrain-core and integrated bridge, foam, support, expiry, collapse, cooldown, energy, and objective settlement.
- Added content definition validation for fallback absence, ambiguous targets, missing requirements, unequipped modules, required-module energy deadlocks, and permanently unaffordable loadouts.

## Architecture and compatibility changes

ADR 0004 establishes battle-core as the single engine-independent authority and freezes explicit phase, action, energy, durability, target identity, module registry, and environment settlement rules. `docs/architecture/BATTLE_RULES.md` records the state and command boundaries for Phase 4 AI, Phase 5 Cocos integration, replay verification, and future PvP.

| Dimension         | Change         | Reason                                                                                                   |
| ----------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `rulesVersion`    | 0.2.0 -> 0.3.0 | Whole-round action, energy, durability, objectives, modules, fields, and settlement become authoritative |
| `protocolVersion` | 0.1.0 -> 0.2.0 | Adds authority phase commands, fallback actions, battle effect/phase events, and module target identity  |

`replaySchemaVersion` remains `0.1.0`. Client, server, content, and save versions remain `0.0.0`. No released save or replay requires migration.

## Database and API changes

No database, service, queue, HTTP endpoint, credential, or network dependency was added. Protocol DTOs remain strict runtime-validated JSON contracts. The future server and worker must select rules `0.3.0` and protocol `0.2.0` explicitly rather than accepting unversioned battle outcomes.

## Security and privacy impact

Phase 3 collects and stores no personal information. No WeChat SDK, identifier, nickname, avatar, device information, free text, credential, or production secret was introduced.

Clients cannot submit damage, energy, terrain, objective, score, or victory outcomes. Commands fail closed on schema, authority actor, battle/turn/phase envelope, actor team, authoritative origin, range, energy, cooldown, loadout, destination occupancy/support, and target ID/coordinate mismatch. Logical hashes detect drift and corruption but are not represented as cryptographic anti-tamper signatures.

## Test results

Final pre-commit repository evidence:

- Frozen install, formatting, workspace/infrastructure policy, content/asset/secret checks, ESLint, strict TypeScript, and build passed.
- Full repository tests: 192 passed.
- `battle-core`: 76 tests passed; 96.52% statements / 90.67% branches / 98.04% functions / 98.16% lines.
- `terrain-core`: 28 tests passed; 98.25% statements / 94.96% branches / 100% functions / 98.93% lines.
- `deterministic-runtime`: 35 tests passed; 99.09% statements / 95.00% branches / 100% functions / 99.06% lines.
- `protocol`: 27 tests passed.
- Golden battle: 13 command checkpoints pinned; final hash `52314be76f79b183`.
- Property suite: 128 seeded whole rounds repeat exactly and retain valid state, contiguous events, exactly three players, and bounded energy.
- Determinism policy and all golden/property suites passed.
- Official npm high-severity audit found no known vulnerability; CycloneDX 1.6 SBOM generation produced 225 components.

The Phase 2 192 by 96 terrain benchmark remains the applicable authority performance scenario because Phase 3 does not introduce a new frame or server tick loop. The final sample collapsed 2,200 cells after inspecting 2,519 cells at 12.74 ms median / 17.33 ms p95, below the 100 ms authority budget.

## Content and asset checks

The 18 module and 36 route IDs are frozen rule identifiers with i18n keys. Phase 3 adds no release artwork, audio, fonts, marketing material, user-generated content, or competitor asset. Working module/robot names remain internal until originality, trademark, and platform similarity review.

The module registry is rule data, not final balance or authored expedition content. Phase 6 will publish versioned content records, route pools, missions, tutorials, and reward compatibility through the content pipeline.

## Known limits

- AI behavior trees, utility scoring, eight enemy profiles, elite affixes, four bosses, and debug visualization are Phase 4 work. Current enemy fixtures only prove the shared legal command path.
- Full projectile stepping, aiming UI, input, camera, animation, audio, and accessibility presentation are Phase 5 work.
- Complete authored maps, expedition routes, workshops, events, unlocks, and tutorial progression are Phase 6 work.
- Database saves, account integration, replay verification workers, daily challenges, and leaderboards are later phases.
- No release-quality art/audio or final public brand is claimed.

## External blockers

Phase 3 has no new external blocker. Docker remains unavailable locally as `DEV-001`, but this phase adds no container-dependent behavior. WeChat credentials/entity, production infrastructure, legal/publishing review, trademark review, approved art/audio, and real-device access remain tracked in `EXTERNAL_BLOCKERS.md` for their applicable phases.

## AGENTS.md Gate checklist

- [x] Three-player whole-round action authority is implemented.
- [x] Movement, energy, cooldown, HP, structural damage, and objectives are implemented.
- [x] All 18 modules have non-empty base mechanics.
- [x] Every module has two mutually exclusive gameplay-changing routes.
- [x] Critical module/terrain/field/durability/objective combinations have automated tests.
- [x] Critical interactions and zero-energy fallbacks prevent energy lockout.
- [x] Content validation rejects required-module and global energy deadlocks.
- [x] Commands and events are strict, bounded, checkpointed, and deterministic.
- [x] Golden and seeded property tests pass.
- [x] Battle, terrain, and deterministic runtime coverage exceeds 95% statements / 90% branches.
- [x] Architecture, ADR, status, plan, issues, and blocker records are updated.
- [x] No secret, personal information, unlicensed asset, or open P0/P1 issue is introduced.

The local full repository Gate is complete. The phase is not publication-complete until GitHub required checks are green and the PR is normally squash-merged without bypass.
