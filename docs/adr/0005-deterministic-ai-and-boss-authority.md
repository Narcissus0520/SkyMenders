# ADR 0005: Deterministic AI and boss authority

- Status: Accepted
- Date: 2026-07-22

## Context

Phase 4 requires eight distinct enemy roles, difficulty that is fair rather than a health/damage multiplier, tested elite combinations, and four multi-stage bosses. AI must be replayable and must not read unconfirmed player input or bypass the legal command rules established in Phase 3. Boss mechanics also need durable, replay-safe progress rather than presentation-only stage flags.

Phase 3 modeled one energy pool. Once enemies began issuing real module commands through the same reducer, that model allowed enemy actions to consume player resources. Team energy therefore needs to be independent before AI becomes authoritative.

## Decision

1. Add `@skymenders/ai-core` as an engine-independent deterministic planner. It may read confirmed `BattleState` and its own bounded authority state, but it may change battle state only through `reduceBattleCommand`.
2. Split battle energy into player and enemy pools. Costs, waits, and settlement regeneration select the acting team. Both pools are present in canonical state and runtime validation.
3. Use a behavior tree for macro-goal selection and a nine-dimension integer utility model for concrete legal action selection. Stable candidate IDs are the final tie-break.
4. Generate a bounded candidate set and dry-run every candidate through the shared battle reducer. Rejected commands may appear in debug traces but cannot be selected. Revalidate the final aim-adjusted command before returning it.
5. Store functional `ai` and `aim_error` RNG stream states independently with a bounded decision index. Difficulty changes search breadth, awareness, and seeded aim error; it does not multiply HP/damage or expose hidden player input.
6. Freeze eight enemy prototype IDs, six elite-affix IDs, and eight whitelisted elite templates. Elite effects alter tested utility preferences and legal mechanics, not hidden combat scalars.
7. Freeze four boss IDs with three stages each. Each stage has two counter signals and each boss has two complete solution routes. Counter progress accepts only runtime-valid effects from accepted, checkpointed player module commands, once per command ID.
8. Persist boss stages, progress, completion, stage history, and consumed command IDs in `AiAuthorityState`. A completed boss remains phase-legal by issuing a shared-reducer wait command.
9. Expose a serializable, read-only debug model with behavior trace, candidate legality, utility vectors, scores, selection markers, and aim error.
10. Advance `rulesVersion` from `0.3.0` to `0.4.0`. Start the AI state schema at `0.1.0`; keep protocol `0.2.0` and replay schema `0.1.0`.

## Consequences

- Enemy behavior is explainable and reproducible from versioned state, seed, and confirmed commands.
- AI and players share phase, position, energy, cooldown, loadout, target, objective, terrain, and module validation.
- Adding an enemy, affix, elite template, boss, stage, counter signal, or difficulty requires catalog validation and deterministic behavioral tests.
- A save or replay containing AI must preserve `AiAuthorityState` alongside `BattleState`; reconstructing RNG or boss progress from visuals is not valid.
- Difficulty has transparent behavioral levers and cannot silently compensate by rewriting combat results.

The bounded planner searches a useful tactical subset rather than every possible coordinate/angle/power combination. Phase 6 encounter simulation may tune weights and candidate sampling, but it must preserve the command boundary and deterministic contract.

## Rollback and compatibility

No released save or replay references rules `0.4.0`. Before release, the AI package, enemy-energy split, and new rule constant can be reverted together. Once a persisted record references rules `0.4.0` or AI schema `0.1.0`, readers must select compatible reducers or migrate explicitly.

The Phase 4 golden battle hash is `548962a665215902`; the AI golden decision hash is `13f36ad335ed11bf`.
