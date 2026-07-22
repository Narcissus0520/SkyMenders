# AI Authority Architecture

Status: Phase 4 implementation complete locally.

## Boundary

`@skymenders/ai-core` is a deterministic command planner, not a second battle engine. It receives a confirmed immutable `BattleState` plus `AiAuthorityState` and returns a command, trace, and next AI state. Every candidate and final command is evaluated by `@skymenders/battle-core`; AI cannot call damage, teleportation, terrain mutation, energy mutation, objective completion, or victory APIs directly.

The input excludes client aiming drafts, pointer movement, unconfirmed choices, camera state, wall-clock time, frame time, device state, and network timing. Later Cocos and server integrations must keep those values outside the planner.

## Decision pipeline

```text
confirmed BattleState + AiAuthorityState
  -> behavior tree selects a macro goal
  -> bounded candidate generation
  -> shared reducer legal dry-run
  -> nine-dimension utility evaluation
  -> stable score and ID ordering
  -> seeded aim-error application
  -> final shared reducer validation
  -> accepted BattleCommand + trace + next AI state
```

Candidate limits are hard-bounded per difficulty and by the global maximum. A full enemy phase is also bounded per actor. If no tactical candidate is legal, the planner chooses a legal wait; it never writes a desired result into battle state.

## Behavior and utility

The behavior tree selects among recovery, objective security, support disruption, field control, pressure, repositioning, and waiting. Conditions are derived only from the confirmed battle snapshot and the controller's catalog flags.

Utility uses explicit integer dimensions:

- task benefit;
- expected damage;
- terrain benefit;
- self-safety;
- control benefit;
- energy cost;
- friendly-fire risk;
- fall risk;
- next-round exposure risk.

Enemy prototypes and elite affixes adjust weights and preferred mechanics. The elite whitelist prevents arbitrary untested affix combinations.

## Difficulty

Normal, hard, and expert profiles change candidate search breadth, target breadth, objective/hazard awareness, and deterministic angle/power error. They do not multiply HP or damage, grant illegal information, change hit results after selection, or bypass projectile and module rules.

The `ai` and `aim_error` streams are independently derived from the battle root seed. Additional aim-error draws cannot perturb tactical tie-breaking, and additional tactical draws cannot perturb aim error.

## Enemy catalog

The launch catalog has one definition for each required role: scout, guard, artillery, driller, magnet, repairer, wind controller, and carrier. Each definition supplies a valid battle loadout, selected module routes, behavior flags, goal preferences, and utility weights. All use the same action/energy/cooldown/target validation as player robots.

Six elite affixes are available only through eight named whitelist templates. Affixes change decision priorities or preferred legal mechanics; no affix applies an untracked health or damage multiplier.

## Boss state machines

The rift drill, polar magnetic tower, inverted controller, and unbound island mainframe each have three deterministic stages. A stage exposes a cue, mechanic, preferred legal actions, exactly two counter signals, and required progress. Two complete, tested solution routes exist per boss.

Counter progress accepts only effects from a runtime-valid, accepted, checkpointed player module command. The boss runtime records used command IDs to prevent replaying one result. Stage changes and completion emit structured events for later UI/audio presentation; they do not grant presentation code authority.

## Debugging and persistence

The debug view serializes behavior-tree outcomes, every bounded candidate's legal/rejected state, utility vector, weighted score, selected command, and aim error. It is derived diagnostic data and must not be accepted as an authority input.

Resumes, replays, daily verification, and future PvP records that include AI must persist and hash both battle and AI authority state: rules/schema versions, root seed, difficulty, decision index, both RNG states, controller bindings, and boss runtime states.

## Compatibility and limits

Phase 4 advances only `rulesVersion` from `0.3.0` to `0.4.0`. AI schema starts at `0.1.0`; protocol and replay schema remain `0.2.0` and `0.1.0`. Full authored encounter composition belongs to Phase 6, Cocos debug presentation belongs to Phase 5, and server replay verification belongs to Phase 8.
