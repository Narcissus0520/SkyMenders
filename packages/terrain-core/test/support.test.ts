import { describe, expect, it } from "vitest";

import {
  analyzeTerrainSupport,
  applyTerrainDamage,
  clearTerrainDirtyChunks,
  createTerrainState,
} from "../src/index.js";

describe("local support connectivity", () => {
  it("lets high-support alloy span farther than cloud soil", () => {
    const make = (materialId: "terrain_alloy_frame" | "terrain_cloud_soil") =>
      createTerrainState({
        width: 12,
        height: 3,
        fills: [{ x: 0, y: 1, width: 10, height: 1, materialId }],
        supportRoots: [{ id: "anchor", kind: "fixed_anchor", x: 0, y: 1, capacity: 500 }],
      });
    const alloy = analyzeTerrainSupport(make("terrain_alloy_frame"), { scope: "full" });
    const soil = analyzeTerrainSupport(make("terrain_cloud_soil"), { scope: "full" });
    expect(alloy.supportedCellIndices).toHaveLength(10);
    expect(soil.supportedCellIndices).toHaveLength(2);
    expect(soil.unstableComponents[0]).toHaveLength(8);
  });

  it("recomputes only occupied components touching dirty chunks", () => {
    const initial = clearTerrainDirtyChunks(
      createTerrainState({
        width: 64,
        height: 4,
        fills: [
          { x: 1, y: 1, width: 3, height: 1, materialId: "terrain_alloy_frame" },
          { x: 40, y: 1, width: 3, height: 1, materialId: "terrain_alloy_frame" },
        ],
        supportRoots: [
          { id: "left", kind: "fixed_anchor", x: 1, y: 1, capacity: 1_000 },
          { id: "right", kind: "support_structure", x: 40, y: 1, capacity: 1_000 },
        ],
      }),
    );
    const changed = applyTerrainDamage(initial, { x: 41, y: 1, radius: 0, energy: 1 }).state;
    const local = analyzeTerrainSupport(changed);
    const full = analyzeTerrainSupport(changed, { scope: "full" });
    expect(local.inspectedCellCount).toBe(3);
    expect(full.inspectedCellCount).toBe(6);
    expect(local.inspectedChunks).toEqual([{ x: 1, y: 0 }]);
    expect(analyzeTerrainSupport(clearTerrainDirtyChunks(changed)).inspectedCellCount).toBe(0);
  });

  it("is stable across repeated analysis", () => {
    const state = createTerrainState({
      width: 10,
      height: 6,
      fills: [
        { x: 0, y: 0, width: 5, height: 2, materialId: "terrain_cloud_soil" },
        { x: 7, y: 4, width: 2, height: 2, materialId: "terrain_elastic_moss" },
      ],
      supportRoots: [{ id: "root", kind: "fixed_anchor", x: 0, y: 0, capacity: 10_000 }],
    });
    expect(analyzeTerrainSupport(state, { scope: "full" })).toEqual(
      analyzeTerrainSupport(state, { scope: "full" }),
    );
  });

  it("keeps the strongest root result when roots share an attachment", () => {
    const state = createTerrainState({
      width: 4,
      height: 2,
      fills: [{ x: 0, y: 0, width: 4, height: 1, materialId: "terrain_cloud_soil" }],
      supportRoots: [
        { id: "a:weak", kind: "support_structure", x: 0, y: 0, capacity: 100 },
        { id: "b:strong", kind: "fixed_anchor", x: 0, y: 0, capacity: 2_000 },
      ],
    });
    expect(analyzeTerrainSupport(state, { scope: "full" }).supportedCellIndices).toHaveLength(4);
  });
});
