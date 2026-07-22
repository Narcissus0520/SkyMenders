# Terrain System

## Authority boundary

`@skymenders/terrain-core` owns the logical terrain grid, material integrity, damage, repair, support analysis, collapse placement, map validation, operation checkpoints, and terrain state hashes. Cocos contour meshes, particles, fragments, camera motion, and interpolation consume terrain events but never feed values back into authoritative state.

The grid origin is the lower-left cell. `x` increases rightward and `y` increases upward. Terrain state uses parallel flat integer arrays for material code and integrity, avoiding object identity and insertion-order effects. State dimensions are bounded to 32,768 cells so canonical hashing remains within the deterministic runtime limits.

## Chunking and dirty regions

- Logical chunks are fixed at 32 by 32 cells.
- Initial state marks every chunk dirty for first render consumption.
- Damage, repair, and collapse mark only touched chunks and adjacent seam chunks dirty.
- `clearTerrainDirtyChunks` is called after presentation has consumed changes.
- Local support analysis starts from dirty chunks plus a one-cell boundary and follows only connected occupied components.
- Full analysis is an explicit load-time and validation operation. It is not a per-frame path.

## Materials

The rules registry contains exactly four base material identifiers:

| ID                       | Authority behavior                                                              |
| ------------------------ | ------------------------------------------------------------------------------- |
| `terrain_cloud_soil`     | Low hardness, medium support, cheap repair, ordinary projectile response        |
| `terrain_alloy_frame`    | High hardness and support, magnetic interaction, low projectile restitution     |
| `terrain_energy_crystal` | Medium-low hardness, weak support, releases deterministic energy on destruction |
| `terrain_elastic_moss`   | Low hardness/support, high restitution, reduces collapse impact                 |

Each definition includes hardness, support transmission, repair cost, projectile restitution, collapse impact, magnetic response, energy release, and an accessibility pattern key. Visual textures are a later client concern, but they must implement these stable pattern keys and cannot replace non-color cues.

## Damage and repair

Damage uses an integer circular mask with a maximum radius of 64 cells. Effective damage is divided by material hardness and clamped to the current integrity. Crystal energy release is based only on destroyed cells. Repair validates energy, material compatibility, and occupied/empty-cell rules before calculating an integer cost; partial repair is explicit and deterministic.

Both operations return a new detached state plus sorted changed cells and material-effect records. They never mutate the input state.

## Support analysis

Fixed anchors and support structures are stable root records with capacity. Occupied roots seed a max-capacity propagation. Crossing a cell consumes `1001 - supportPermille` capacity, so stronger materials transmit support farther. A deterministic max-heap and stable cell/root tie-breaks make the result independent of construction history.

Supported indices and unstable connected components are sorted canonically. A destroyed root remains in the state envelope but no longer seeds support; a compatible repair may reattach it. Initial map creation and map validation require roots to be attached.

## Collapse

Unstable components are removed from the grid, ordered from lower to higher components, and resolved as bounded rigid blocks. Each block travels straight downward one cell at a time until it reaches the world boundary or an already stable/settled cell. It either settles as a whole or is lost below the map. Settled cells mark their destination chunks dirty.

Collapse events record stable block IDs, sorted source/destination indices, fall distance, outcome, and material-weighted impact energy. Long-lived debris physics is presentation-only. The operation executor records a state hash after every damage, repair, and collapse operation, making terrain sequences replayable and drift-detectable.

## Map validation

Load-time validation rejects maps with invalid or overlapping spawns, unsupported objectives, missing required capabilities, blocked or duplicate navigation cells, unreachable completion paths, AI-inaccessible engagement areas, detached anchors, camera bounds that omit critical cells, or terrain that is fully unstable at first settlement.

Validation returns stable issue codes, locations, details, and metrics suitable for the later Content Studio batch simulator. Runtime inputs are still checked by terrain operations; editor validation is not treated as a trust boundary.

## Performance evidence

The Phase 2 benchmark uses a 192 by 96 grid, cuts a bridge, analyzes 2,519 locally reachable occupied cells across nine chunks, and collapses a 2,200-cell island. Fifteen measured runs after three warmups must remain below a 100 ms p95 budget in CI. The latest 2026-07-22 local sample measured 11.17 ms median and 15.67 ms p95.

## Compatibility

Terrain authority behavior advances `rulesVersion` from `0.1.0` to `0.2.0`. Protocol, replay schema, content, save, client, and server versions remain unchanged. Any future change that alters material codes, support propagation, collapse ordering, operation semantics, or golden hashes is a rules compatibility change.
