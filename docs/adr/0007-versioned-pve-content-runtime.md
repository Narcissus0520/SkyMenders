# ADR 0007: Versioned PvE content pack and deterministic expedition runtime

- Status: Accepted
- Date: 2026-07-22

## Context

Phase 6 turns the deterministic battle, terrain, AI, and Cocos foundations into a complete four-region PvE expedition. Authored data must remain editable, localizable, independently versioned, reproducible from a seed, and impossible to publish when it references missing authority definitions or creates an unsolvable base map.

## Decision

1. Store product content as strict JSON catalogs under `content/`, with every player-facing string represented by a localization key and Simplified Chinese values in `content/localization/zh-CN.json`.
2. Parse every catalog through `@skymenders/content-schema` and then perform pack-wide checks for exact minimum catalogs, unique IDs, reference integrity, module slot classes, objective roles, map capabilities, progression prerequisites, localization coverage, and version agreement.
3. Cross-check authored module, upgrade route, enemy, and Boss IDs against `battle-core` and `ai-core`. Materialize each authored map through `terrain-core` and reject any map with invalid spawns, initial collapse, missing completion paths, unreachable AI engagement points, unavailable capabilities, or incomplete camera coverage.
4. Generate four deterministic region plans from the root seed using the existing isolated map and event RNG streams. Each region exposes four to six candidates over two selectable layers followed by its fixed Boss, producing twelve actually visited nodes in a successful standard expedition.
5. Lock each three-choice reward set at first generation from the reward stream. Favor upgrades for owned modules, guarantee legal choices, diversify reward kinds, and suppress repeated attack-only categories.
6. Keep workshop transactions, authored event effects, research unlocks, achievements, compendium discovery, route visibility, node recovery, and the single node-restart ledger in engine-independent `content-runtime` state.
7. Restrict progression unlocks to content and strategic options. The progression schema has no permanent base-health, base-damage, energy-cap, accuracy, critical, mitigation, or reward-multiplier fields.
8. Model all six tutorials as ordered validated actions. Instruction text may be skipped; required interactions cannot be skipped. Standard expedition unlocks only after tutorial six, and formal daily scoring remains gated behind completion of standard region one.
9. Advance `contentVersion` to `0.1.0`, `rulesVersion` to `0.5.0`, and `clientVersion` to `0.2.0`. Save, replay, protocol, and server versions remain unchanged.

## Consequences

- A catalog cannot drift silently from authority code, and bad cross-references fail CI before reaching Cocos or a server.
- Route, event, and reward outcomes reproduce from seed and index without client time or `Math.random()`.
- Cocos receives a read-only PvE flow model and local `feature-pve` subpackage; combat state still changes only through the established battle command reducer.
- Authored base maps are intentionally conservative skeletons. Seeded variation may change approved slots, but every produced variant must rerun the same pre-battle validation before use.

## Rollback and compatibility

No released save references content `0.1.0`. Removing Phase 6 can restore rules `0.4.0`, content `0.0.0`, and client `0.1.0` without migrating a public save. Future incompatible content or expedition-rule changes must version the affected dimension and preserve old packs for replay and save recovery.
