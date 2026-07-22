# ADR 0003: Chunked terrain, support, and collapse

- Status: Accepted
- Date: 2026-07-22
- Owners: deterministic simulation, terrain

## Context

Destruction, construction, repair, support, and local collapse are core product mechanics. They must reproduce in Node.js, Cocos, replay workers, and future PvP authority without relying on engine physics, frame timing, or full-map work every frame. Maps must also be rejectable before play when objectives or navigation would become unsolvable.

## Decision

1. Store authoritative terrain as bounded parallel flat arrays of stable material codes and integer integrity, using a lower-left origin and 32 by 32 logical chunks.
2. Keep material behavior in a frozen four-entry rule registry. Material codes and behavior are rules, while later art and editable map layouts are content.
3. Track dirty chunks after every terrain mutation and include neighboring seam chunks. Use dirty-component support analysis for runtime updates; reserve full analysis for initial load, validation, and explicit diagnostics.
4. Represent anchors and constructed supports as stable roots with capacity. Propagate remaining capacity with a deterministic max-heap, material-specific support cost, and explicit tie-breaks.
5. Resolve each unstable connected component as a rigid block in a deterministic lower-first order. A block moves only downward until it settles or leaves the grid. Presentation debris is derived from events and is never authoritative.
6. Execute damage, repair, and collapse through immutable operation records and emit a canonical state hash after every operation.
7. Validate spawn legality, objective stability/reachability, capabilities, navigation, AI access, anchors, camera coverage, and first-settlement stability before admitting a map.
8. Advance only `rulesVersion` to `0.2.0`.

## Alternatives considered

1. Engine colliders and rigid bodies as authority: rejected because results can depend on engine version, solver order, and frame rate.
2. A texture or polygon mesh as authority: rejected because rendering representations are costly to canonicalize and hard to validate cell-by-cell.
3. Per-cell objects: rejected because object overhead and identity complicate large state hashing; parallel integer arrays are compact and canonical.
4. Full-map support recomputation after every edit: rejected because it violates the bounded dirty-region requirement and scales with unrelated terrain.
5. Connectivity-only support: rejected because it cannot express the distinct support strength of the four materials or limited temporary structures.
6. Independent falling cells: rejected because it fragments structures, produces excessive events, and creates ordering ambiguity.

## Consequences

The authority model intentionally simplifies collapse to rigid vertical blocks. More elaborate visual tumbling may be shown only if it converges to the authoritative destination and cannot influence collisions or damage. Runtime callers must clear consumed dirty chunks and must request full analysis only at defined lifecycle boundaries.

Map authors need explicit anchors, navigation cells, required/provided capabilities, camera bounds, and objective locations. These fields enable useful validation and later batch simulation but increase authoring discipline.

The accessibility pattern keys are part of the material contract, while final textures remain an external asset dependency. This phase does not claim release-quality visuals.

## Migration and compatibility impact

No player save or released content exists. `rulesVersion` advances from `0.1.0` to `0.2.0`; all other version dimensions stay unchanged. The Phase 2 golden sequence freezes the post-damage checkpoint `3c35bec410593720`, post-collapse state `bb473002eac7e50e`, and collapse-event hash `5ee339be9f95cdca`.

Readers of future saves or replays must select terrain rules by `rulesVersion`. An intentional hash change requires a new rules version and compatibility evidence rather than rewriting old expectations.

## Rollback

Before player data exists, the package and version change can be reverted together. After any released record references rules `0.2.0`, rollback must retain a compatible terrain reader/executor and may not reinterpret the record under different collapse semantics.
