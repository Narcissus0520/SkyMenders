# ADR 0004: Whole-round battle and module authority

- Status: Accepted
- Date: 2026-07-22

## Context

Phase 3 requires a complete engine-independent PvE battle rule layer: three player robots act once in a whole-round sequence, enemies use the same command model, terrain settles deterministically, shared energy cannot remove every fallback action, and all 18 launch modules need real mechanics with two mutually exclusive upgrade routes. The same state transitions must later support replay verification and server-authoritative PvP.

The Phase 1 protocol did not include authority-only phase advancement or zero-energy fallback actions. It also could not bind a module-required objective to a stable target identifier. Phase 2 terrain roots were immutable after map creation, preventing temporary support modules from participating in authority rules.

## Decision

1. `@skymenders/battle-core` owns immutable battle state and command reduction independently of Cocos, networking, databases, and wall-clock time.
2. The phase order is explicit: `player_planning`, `player_action`, `enemy_action`, and `environment_settlement`. Only actor `system` may advance a phase. Every active actor on the current team must finish before authority can advance.
3. A battle contains exactly three player robots. Movement, main-module use, auxiliary-use count, cooldowns, disabled state, objectives, fields, temporary terrain/support, and shared energy are included in the hashed state.
4. Shared energy defaults to maximum 12 and regeneration 6. Normal movement, critical task interaction, basic push, and basic repair cost zero energy. Content validation rejects missing fallbacks, unaffordable required modules, and permanently unaffordable loadouts.
5. HP and structural damage are separate. Source-specific faults are capped at two, can add cost/range/cooldown penalties, and never remove critical interactions or every fallback. Disabled robots leave beacons and drop carried objects at a deterministic safe point.
6. The registry contains exactly eight main and ten auxiliary module identifiers. Each definition declares cost, cooldown, action-ending behavior, target mode, range, and exactly two mutually exclusive mechanical routes. An exhaustive resolver implements every identifier; unknown identifiers fail closed.
7. A module command may include `targetId` only with target coordinates. Authority verifies that the ID identifies an active actor or world object at those coordinates before a module-required objective can progress.
8. Temporary supports use explicit terrain-core add/remove operations. Environmental settlement expires fields, supports, and temporary terrain before deterministic terrain collapse, unsupported actor/object fall, configured fall damage, cooldown decrement, actor reset, objective settlement, and energy regeneration. A primary target that leaves the battle fails the battle.
9. `rulesVersion` advances from `0.2.0` to `0.3.0`; `protocolVersion` advances from `0.1.0` to `0.2.0`. Replay schema and unrelated product dimensions do not change.

## Consequences

- Clients and future AI submit commands rather than damage, movement, terrain, objective, or victory outcomes.
- Every accepted command produces contiguous protocol events and a canonical state checkpoint.
- Content tools can prove the configured energy ceiling and fallback rules before a map is published.
- Module additions require a registry entry, exhaustive mechanic, runtime target validation, both route contracts, and tests; there is no empty-handler path.
- Presentation may animate emitted effects but cannot feed visual physics or timing back into authority state.

The current projectile-field helper applies deterministic field transformations but is not yet the full Phase 5 aiming/flight presentation loop. Enemy planning and boss strategy remain Phase 4 responsibilities; they must call this same command reducer.

## Rollback and compatibility

No released player save or replay references rules `0.3.0`. Before release, this change may be reverted together with the new battle package and protocol variants. After any persisted replay references protocol `0.2.0` or rules `0.3.0`, readers must select the matching reducer/protocol or migrate explicitly; they may not reinterpret the command log under older rules.

The Phase 3 golden round freezes 13 checkpoint hashes and final state hash `52314be76f79b183`.
