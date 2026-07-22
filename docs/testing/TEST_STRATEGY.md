# Test Strategy

Testing is layered:

- Unit and property tests cover deterministic math, rules, content policies, migrations, scoring, and invariants.
- Golden replays detect intentional and accidental rule drift.
- Integration tests use real PostgreSQL and Redis dependencies for API, queue, idempotency, and deletion behavior.
- Playwright covers Content Studio and Admin Console workflows.
- Cocos smoke, WeChat Developer Tools, and real devices cover presentation, input, resume, package, and performance behavior.
- Security tests cover identity spoofing, replay, authorization, tampering, injection, request limits, secrets, dependencies, and deletion completeness.

Core deterministic packages must reach at least 95% statement and 90% branch coverage; other core packages target 85% statement and 80% branch coverage. Coverage complements, not replaces, behavioral gates.

## Phase 2 terrain evidence

- Unit tests cover all four material contracts, state invariants, dirty-chunk seams, damage, repair, support capacity, root attachment, collapse ordering/placement, map-validation issue codes, and terrain operation checkpoints.
- A seeded property suite generates 64 bounded terrain cases and checks damage monotonicity, immutable input state, repeat equality, deterministic support/collapse, valid material/integrity pairs, and identical state hashes.
- The large-collapse golden test freezes the operation checkpoints, final state hash, event hash, component size, inspected-cell bound, and repeat execution result.
- The terrain performance command exercises the same scenario after warmup and enforces the documented p95 budget.

## Phase 3 battle evidence

- Registry tests prove exactly 18 module IDs, exactly two mechanical routes per module, legal energy ranges, slot ownership, and route exclusivity.
- Mechanic and combination tests execute the base behavior and both upgrade routes, energy recycling/overload, projectile fields, temporary support/terrain expiry, structural faults, deterministic task-object drops, and objective completion.
- Boundary suites reject wrong authority, phase, turn, actor, origin, loadout, cooldown, energy, range, occupancy, support, entity identity, and malformed state or content definitions.
- Content validation proves zero-energy push/repair fallbacks and rejects unequipped or theoretically unaffordable required modules.
- The golden round freezes every command checkpoint and final hash. A seeded property suite repeats 128 generated whole rounds and checks equality, event sequence, state validity, three-player composition, and energy bounds.
- `battle-core`, `terrain-core`, and `deterministic-runtime` independently enforce at least 95% statement and 90% branch coverage.

## Phase 4 AI and boss evidence

- Catalog tests freeze exactly eight enemy prototypes, six elite affixes, eight whitelisted elite templates, three difficulty profiles, and four three-stage bosses with complete i18n and loadout contracts.
- Planner tests prove that generated and selected actions pass the shared battle reducer, rejected candidates cannot be selected, enemy phases terminate within a bounded attempt count, and player and enemy energy remain isolated.
- Role tests exercise scout, guard, artillery, driller, magnet, repairer, wind, and carrier mechanics. Every elite whitelist entry is instantiated and changes decision weighting without multiplying HP or damage.
- Difficulty tests prove that search breadth, objective/hazard awareness, and seeded aim error vary while actor HP, module damage rules, and the legal command path stay unchanged.
- Boss tests complete all four bosses through both declared solution routes, reject duplicated/uncheckpointed/malformed counter evidence, advance deterministic stages, and keep completed bosses phase-legal through wait commands.
- The AI golden decision freezes command, trace, next RNG state, and canonical hash. A 48-seed property suite repeats complete enemy phases and validates both battle and AI authority states.
- Serializable debug-view tests cover behavior traces, candidate utility vectors, rejection reasons, selection markers, and text rendering without exposing a mutation path.
- `ai-core` enforces at least 85% statement and 80% branch coverage; battle, terrain, and deterministic runtime retain their stricter 95%/90% gates.
