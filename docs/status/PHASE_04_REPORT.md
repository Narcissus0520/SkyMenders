# Phase 04: AI, enemies, elites, and bosses

## Phase goal

Deliver deterministic PvE enemy authority on top of the shared Phase 3 battle reducer: behavior trees, utility selection, fair difficulty, eight enemy roles, tested elite variants, four multi-stage bosses, and inspectable decision evidence.

The result is authority code, not scripted presentation. AI reads only confirmed state and returns normal `BattleCommand` values. A Cocos client, replay worker, or future PvP server can execute and verify the same decisions without granting AI a private mutation path.

## Main implementation

- Added `@skymenders/ai-core` with bounded schema/rules versions, controller bindings, decision index, independent functional RNG states, boss runtimes, runtime validation, and canonical hashing support.
- Implemented a behavior tree for recovery, objective security, support disruption, field control, pressure, repositioning, and waiting.
- Implemented integer utility vectors for task benefit, expected damage, terrain benefit, self-safety, control benefit, energy cost, friendly-fire risk, fall risk, and next-round exposure.
- Implemented bounded candidate generation for movement, basic fallback actions, all equipped modules, and waiting. Candidates are legal only if a dry run through `reduceBattleCommand` succeeds.
- Applied difficulty-bounded angle and power error from the independent `aim_error` stream, followed by a second authority validation. Tactical tie-breaking uses the independent `ai` stream.
- Implemented bounded full enemy-phase execution with stable actor ordering and a legal wait fallback.
- Split battle energy into independent player and enemy pools. Enemy module costs and waits cannot consume or replenish player energy, and both pools settle deterministically.
- Implemented normal, hard, and expert profiles through search breadth, target breadth, awareness, and seeded error. No difficulty profile changes HP or damage.
- Added scout, guard, artillery, driller, magnet, repairer, wind-controller, and carrier definitions with rule-valid loadouts and role-specific decision mechanics.
- Added stable core, reflective shell, overdrive circuit, coordinated protocol, emergency patch, and hover chassis affixes through eight named whitelist templates.
- Added the rift drill, polar magnetic tower, inverted controller, and unbound island mainframe. Every boss has exactly three stages, two counter signals per stage, and two complete declared solution routes.
- Boss progress accepts only effects emitted by a runtime-valid, accepted, checkpointed player module command. Used command IDs are retained to prevent duplicate progress.
- Added serializable debug models and text rendering for behavior traces, every bounded candidate, legality/rejection, utility vectors, score, selected command, and aim error.
- Extended the root content gate to validate the exact launch catalog, i18n keys, loadouts/routes, weights, difficulty progression, elite whitelist, boss stages, and complete boss solution routes.

## Architecture and compatibility changes

ADR 0005 establishes AI as a deterministic command planner rather than a second battle engine. `docs/architecture/AI_AUTHORITY.md` records the input boundary, decision pipeline, RNG separation, difficulty model, catalog, boss state machines, debug evidence, and persistence requirements.

| Dimension             | Change         | Reason                                                               |
| --------------------- | -------------- | -------------------------------------------------------------------- |
| `rulesVersion`        | 0.3.0 -> 0.4.0 | Adds independent team energy plus enemy/boss deterministic authority |
| `aiSchemaVersion`     | new -> 0.1.0   | Versions controller, RNG, decision, and boss runtime persistence     |
| `protocolVersion`     | unchanged      | AI uses existing strict battle commands/events                       |
| `replaySchemaVersion` | unchanged      | Phase 8 adds the combined battle/AI replay verification envelope     |

Client, server, content, and save versions remain `0.0.0`; protocol stays `0.2.0` and replay schema stays `0.1.0`. No released save or replay requires migration.

## Database and API changes

No database, service, queue, HTTP endpoint, credential, or network dependency was added. The combined battle/AI state contract is ready for later save and replay envelopes, but Phase 4 does not claim cloud persistence or server verification.

## Security, privacy, and fairness impact

Phase 4 collects and stores no personal information. It adds no WeChat SDK, identifier, nickname, avatar, location, device data, free text, credential, or production secret.

AI cannot submit damage, terrain, position, energy, objective, score, or victory outcomes. Every candidate and final command passes player-equivalent battle validation. It receives no unconfirmed player input. Difficulty changes disclosed planning parameters rather than hidden combat outcomes. Elite variants do not multiply durability or damage. Logical hashes detect drift and corruption but are not represented as anti-tamper signatures.

## Test results

Final pre-commit repository evidence on Node.js 24.14.0 and pnpm 10.31.0:

- Frozen install, formatting, workspace/infrastructure policy, content/catalog validation, asset/secret checks, ESLint, strict TypeScript, and build passed.
- Full repository tests: 246 passed.
- `ai-core`: 50 tests passed; 89.78% statements / 83.60% branches / 97.24% functions / 91.50% lines.
- `battle-core`: 79 tests passed; 96.58% statements / 90.77% branches / 98.08% functions / 98.19% lines.
- `terrain-core`: 28 tests passed; 98.25% statements / 94.96% branches / 100% functions / 98.93% lines.
- `deterministic-runtime`: 35 tests passed; 99.09% statements / 95.00% branches / 100% functions / 99.06% lines.
- `protocol`: 27 tests passed.
- Golden battle: 13 command checkpoints pinned; final hash `548962a665215902`.
- Golden AI decision: command, trace, RNG state, and authority state pinned; hash `13f36ad335ed11bf`.
- Property suites: 128 seeded whole rounds and 48 seeded full AI phases repeat exactly with valid bounded state.
- All four bosses complete through both declared solution routes; all eight prototype mechanics and all eight elite templates are exercised.
- Determinism policy and golden/property suites passed.
- AI benchmark: eight expert actors and 19 legal decisions at 289.72 ms median / 309.43 ms p95, below the 1,500 ms full-phase budget.
- Terrain benchmark: 2,200 collapsed cells and 2,519 inspected cells at 14.03 ms median / 17.12 ms p95, below the 100 ms budget.
- Official npm high-severity audit found no known vulnerability; CycloneDX 1.6 SBOM generation produced 225 components.

The battle property test has an explicit 15-second instrumentation timeout because repository-wide coverage runs battle and AI property suites concurrently; normal deterministic execution remains well below that timeout.

## Content and asset checks

Enemy, elite, boss, stage, counter, and difficulty IDs are frozen rule identifiers with i18n keys. Phase 4 adds no release artwork, audio, fonts, marketing material, user-generated content, competitor asset, or final public naming claim. Authored localized text and encounter composition remain Phase 6 content work.

## Known limits

- Cocos rendering, input, aiming preview, camera, animation, audio, accessibility presentation, WeChat lifecycle behavior, and device profiling are Phase 5 work.
- Complete expedition encounters, routes, rewards, events, workshops, unlocks, tutorials, and final balance are Phase 6 work.
- AI debug evidence has a serializable model and text renderer but no Cocos overlay yet.
- Combined battle/AI save migration and server replay verification are later phases.
- No release-quality art/audio or final public brand is claimed.

## External blockers

Phase 4 has no new external blocker. Docker remains unavailable locally as `DEV-001`, but this phase adds no container-dependent behavior. WeChat credentials/entity, production infrastructure, legal/publishing review, trademark review, approved art/audio, and real-device access remain tracked in `EXTERNAL_BLOCKERS.md` for their applicable phases.

## AGENTS.md Gate checklist

- [x] AI reads confirmed authority state and uses independent seeded RNG streams.
- [x] Behavior trees select macro goals and all nine required utility dimensions score concrete candidates.
- [x] Every AI candidate and selected action uses the shared legal battle command path.
- [x] Player and enemy energy pools are independent and deterministic.
- [x] Normal, hard, and expert change behavior/search/error without HP or damage multipliers.
- [x] All eight required enemy prototypes have distinct tested mechanics.
- [x] Six affixes appear only through eight tested elite whitelist templates.
- [x] Four bosses have three stages, multiple counter strategies, two complete tested routes, and replay-safe progress.
- [x] Golden and seeded property tests pass.
- [x] Battle, terrain, and deterministic runtime exceed 95% statements / 90% branches; AI exceeds 85% / 80%.
- [x] Architecture, ADR, compatibility versions, performance evidence, status, plan, issues, and blockers are updated.
- [x] No secret, personal information, unlicensed asset, hidden stat multiplier, or open P0/P1 issue is introduced.

The local full repository Gate is complete. The phase is not publication-complete until GitHub required checks are green and the PR is normally squash-merged without bypass.
