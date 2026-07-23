# Phase 6 Report: Complete PvE Expedition and Authored Content

> Historical note: Phase 11 found that the Phase 6 inventory did not meet the root V1 scale minimums despite this report's earlier “complete” wording. Content `0.2.0` corrects that gap with 48 dedicated maps, 30 events, 20 hidden goals, 8 workshop services, 8 environment mechanics and 12 cosmetics; ADR 0012 records the compatibility decision. The counts below remain the exact Phase 6 delivery record.

## Delivered

- Strict versioned schemas and cross-catalog validation for the complete PvE pack.
- Six robots, eighteen modules and thirty-six routes, eight enemies, four Bosses, eighteen objectives, sixteen map templates, four regions, twelve events, forty-six rewards, four workshop services, eighteen achievements, forty compendium entries, and six tutorials.
- Fixed-seed four-region routes with independent RNG streams, four-to-six candidates per region, two chosen nodes plus one Boss, route visibility, and a twelve-node successful run.
- Locked compatible three-choice rewards, effective run-only modifications, mutually exclusive workshop upgrades, repairs, event effects, inventory, research unlocks, achievement counters, and compendium discovery.
- Configured node recovery, expedition defeat/victory, and one-restart ledger behavior.
- Terrain-core materialization and validation for every authored map before battle.
- A Cocos-facing PvE flow model and local `feature-pve` WeChat subpackage configuration.
- ADR 0007 plus architecture, design, and validation documentation.

## Compatibility

| Dimension                   | Change         | Reason                                         |
| --------------------------- | -------------- | ---------------------------------------------- |
| `contentVersion`            | 0.0.0 -> 0.1.0 | First complete authored PvE content pack       |
| `rulesVersion`              | 0.4.0 -> 0.5.0 | Expedition, reward, workshop, and unlock rules |
| `clientVersion`             | 0.1.0 -> 0.2.0 | PvE flow and local feature subpackage          |
| save/replay/protocol/server | unchanged      | No persistence, wire, or replay change         |

## Acceptance evidence

- All catalog counts and localization references pass `pnpm content:validate`.
- All 16 materialized maps pass spawn, support, completion-path, AI-reachability, capability, and camera checks with zero initially unstable cells.
- A successful simulated expedition visits exactly twelve nodes across all four regions.
- Every generated layer retains a shortest-duration choice; a 250-seed corpus proves a complete 12-node route remains inside the configured 35-45 minute target.
- Boundary-seed route and reward hashes reproduce exactly.
- The expedition benchmark generated 5,000 plans and 119,964 nodes in 161.71 ms, well below its 5-second budget.
- Full repository tests: 297 passed. Format, lint, strict TypeScript, build, coverage, deterministic replay, performance, content/catalog, Cocos static, asset, secret, dependency-audit, and SBOM gates passed.
- Content schema coverage is 95.56% statements / 91.22% branches; runtime coverage is 94.70% / 87.84%; validator coverage is 96.92% / 85.71%.
- The real Cocos editor build correctly stopped with blocker code 2 because Creator 3.8.8 is unavailable. External WeChat device evidence remains tracked separately and is not claimed here.
