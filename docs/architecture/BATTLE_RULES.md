# Battle Rules Architecture

Status: Phase 3 authority implementation complete locally.

## State and authority

`@skymenders/battle-core` is an engine-independent immutable reducer. A state includes compatibility versions, the battle/turn/phase envelope, shared energy, actors, objectives, world objects, persistent and temporary field effects, temporary terrain/support ownership, intelligence, statistics, terrain, and outcome. Runtime validation bounds all collections and numeric values and rejects inconsistent HP, disabled, recovery-beacon, fault, cooldown, loadout, objective, target, and energy state.

Exactly three player robots are required. Neutral or enemy actors may also exist within the global actor bound. Cocos and later server code may render or transport state, but only battle-core commands may change authority state.

## Whole-round sequence

```text
player_planning
  -> player_action (each active player robot acts once)
  -> enemy_action (each active enemy acts through the same command API)
  -> environment_settlement
  -> next player_planning
```

Only the authority identity `system` may issue `advance_phase`. Player and enemy phases cannot finish until every active actor on that team has ended its action. Environment settlement expires consumed/elapsed fields, constructed supports, and temporary terrain; resolves support and collapse; decrements cooldowns; resets per-round action counters; regenerates shared energy; and applies hold/integrity objective signals.

## Action and energy rules

- Each active robot may move once per round within its effective movement allowance.
- A main module may be used once and ends that robot's action.
- Auxiliary modules declare whether they end an action and are capped at two uses per actor per round.
- Wait ends an action and grants bounded energy only while both team energy and the per-round wait allowance have room.
- Default shared energy is 12 maximum, 6 regeneration, and carry-over between rounds.
- Movement, critical interaction, basic push, and basic repair are zero-energy fallbacks.
- Commands use integer logical coordinates. Authority validates phase, turn, actor, origin, range, occupancy, support, energy, cooldown, and target identity before mutation.

## Durability

Actors have `hp` and `structuralDamage` in `0..100`. Damage sources map to bounded faults:

| Source    | Fault direction            |
| --------- | -------------------------- |
| fall      | movement efficiency        |
| overload  | energy/cooldown efficiency |
| collision | stability                  |
| magnetic  | aiming efficiency          |

At 30 structural damage a minor fault appears; at 60 every retained fault becomes major. At most two distinct source-consistent faults are retained. Mobility faults reduce movement, cooling faults increase module cost/cooldown, aiming faults reduce module range, and stability faults increase later fall/collision structural damage. Bubble and stabilizer fields mitigate their declared damage classes. `hp = 0` disables the actor, writes a deterministic recovery beacon, removes it from action requirements, and drops carried objects at the nearest safe point using distance, row, and column ordering. Node recovery defaults to 15% maximum HP for survivors and 35% for disabled robots, plus configured partial structural repair and fault-severity normalization.

## Modules and routes

The registry fixes eight main and ten auxiliary module IDs. Every definition declares an i18n name key, class, energy cost, cooldown, action behavior, target mode, maximum range, and two route records. Each route has mechanism, condition, and tradeoff i18n keys. Loadout validation enforces slot class, no duplicates, equipped ownership, one route per module, and correct route pairing.

The exhaustive resolver implements bridge construction, drilling, magnetic movement/collision, gravity, bubbles, wind, temporary support, projectile rails, actor/terrain repair, reflection, ejection, stabilization, route scanning, energy recycling, grappling, terrain foam, target jamming, and structure scanning. Both routes for every module change range, targeting, duration, material, field behavior, energy exchange, safety, or information—not only a damage scalar.

Module-required objectives use a stable `targetId`. The command must also carry the target's logical coordinates, and authority proves that an active actor or object with that ID occupies those coordinates. Critical interactions remain separate and free, so a task cannot be made impossible by energy exhaustion.

## Projectile fields

The deterministic field helper orders effects by stable ID and applies gravity, wind, energy rail, reflector, rebound bubble, and conductive bridge rules using integers. One-shot fields are consumed in state, reflection statistics are deterministic, and jammer target-score modifiers are available to Phase 4 AI. Full projectile stepping and client trajectory presentation remain bound to the same fixed-point/runtime rules and will be integrated with later battle/client phases.

## Determinism and limits

Every accepted command produces strict protocol events and a canonical checkpoint. Environment settlement also resolves unsupported actors and task objects, applies configured fall damage, and fails objectives whose target leaves the battle. The golden mixed-action round, 128 seeded whole-round property cases, module route/combination tests, and coverage gates detect drift. There is no use of frame time, platform physics, locale sorting, global randomness, or mutable singleton state.

Rules are `0.3.0`, protocol is `0.2.0`, and replay schema remains `0.1.0`.
