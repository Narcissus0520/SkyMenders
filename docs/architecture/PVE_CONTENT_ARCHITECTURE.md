# PvE Content Architecture

## Authority boundary

`content-schema` accepts untrusted JSON and produces a typed content pack. `content-validator` validates references against the authoritative battle, terrain, and AI catalogs. `content-runtime` owns route, reward, event, workshop, progression, tutorial, and run-state transitions. Cocos only presents those results through `PveFlowModel`; it does not invent rewards, mutate combat state, or choose random outcomes.

## Standard expedition

Each fixed seed creates four ordered regions. A region contains two layers with a combined four to six candidate nodes and a fixed third-layer Boss. The player visits one node from each ordinary layer and then the Boss, for twelve completed nodes in a successful run. Current choices are available, the next layer exposes type and risk, and farther layers remain unknown unless an intelligence effect raises reveal depth.

The map and event streams are independent. Adding an event draw cannot perturb map selection. Failed generation should be retried only for its own stream and variation slot; the base catalog never falls back to an unvalidated arbitrary map.

## V1 content inventory and map templates

Content `0.2.0` contains 48 dedicated templates: 24 ordinary battles, 12 engineering missions, 8 elite missions, and 4 Boss arenas. Each ordinary template declares exactly one compatible node type, so deterministic route generation cannot silently reuse an engineering or elite template for a different encounter class. Every region owns six battle, three engineering, two elite and one Boss template.

Templates declare dimensions, material, fixed anchors, spawn points, objectives, capability requirements, and approved variation slots. Validation materializes each template into a `TerrainMapDefinition` and runs the same checks used before battle: stable starting terrain, non-overlapping standable spawns, task access, AI reachability, capability availability, and camera coverage. The V1 scale gate also requires 30 events, 8 workshop services, 8 region environment mechanics, 20 hidden objectives and 12 cosmetics.

## Rewards and progression

Reward sets contain exactly three distinct choices and are locked by seed plus reward index. Module rewards exclude already-owned modules, upgrades require their owned module, and mutually exclusive upgrade routes are enforced by reward and workshop transactions. Authored temporary modifications resolve to bounded run-only movement, energy, fall-damage, or repair modifiers rather than permanent progression. Unlocks expand robots, modules, regions, difficulties, events, maps, routes, and cosmetics. They never change permanent combat baselines. Achievements consume explicit counters, and compendium discovery is idempotent.

## Tutorials

The six tutorials are short, ordered state machines. Every step specifies one validation signal. Text can be skipped, but a step advances only when the required action is observed. Tutorial six unlocks standard expedition; daily practice can unlock with it, while formal scoring requires standard region-one completion.
