import { describe, expect, it } from "vitest";

import {
  analyzeTerrainSupport,
  createTerrainState,
  getTerrainCell,
  resolveTerrainCollapse,
} from "../src/index.js";

describe("deterministic terrain collapse", () => {
  it("settles a rigid unsupported block onto anchored terrain", () => {
    const state = createTerrainState({
      width: 12,
      height: 8,
      fills: [
        { x: 0, y: 0, width: 12, height: 1, materialId: "terrain_alloy_frame" },
        { x: 5, y: 5, width: 3, height: 1, materialId: "terrain_cloud_soil" },
      ],
      supportRoots: [{ id: "anchor", kind: "fixed_anchor", x: 0, y: 0, capacity: 100_000 }],
    });
    const analysis = analyzeTerrainSupport(state, { scope: "full" });
    expect(analysis.unstableComponents).toHaveLength(1);
    const result = resolveTerrainCollapse(state, analysis);
    expect(result.events).toEqual([
      expect.objectContaining({ outcome: "settled", fallDistance: 4 }),
    ]);
    expect(getTerrainCell(result.state, 5, 5)).toBeNull();
    expect(getTerrainCell(result.state, 5, 1)?.materialId).toBe("terrain_cloud_soil");
    expect(result.events[0]?.destinationCellIndices).toHaveLength(3);
  });

  it("removes blocks that leave the logical map and never overlaps cells", () => {
    const state = createTerrainState({
      width: 6,
      height: 6,
      fills: [{ x: 2, y: 3, width: 2, height: 2, materialId: "terrain_energy_crystal" }],
    });
    const analysis = analyzeTerrainSupport(state, { scope: "full" });
    const first = resolveTerrainCollapse(state, analysis);
    const second = resolveTerrainCollapse(state, analysis);
    expect(first).toEqual(second);
    expect(first.events[0]).toEqual(
      expect.objectContaining({ outcome: "lost", fallDistance: 4, impactEnergy: 0 }),
    );
    expect(first.state.materials.every((material) => material === 0)).toBe(true);
  });

  it("uses material fall response for impact energy", () => {
    const make = (materialId: "terrain_alloy_frame" | "terrain_elastic_moss") => {
      const state = createTerrainState({
        width: 5,
        height: 6,
        fills: [
          { x: 0, y: 0, width: 5, height: 1, materialId: "terrain_alloy_frame" },
          { x: 2, y: 4, width: 1, height: 1, materialId },
        ],
        supportRoots: [{ id: "anchor", kind: "fixed_anchor", x: 0, y: 0, capacity: 10_000 }],
      });
      return resolveTerrainCollapse(state, analyzeTerrainSupport(state, { scope: "full" }));
    };
    expect(make("terrain_elastic_moss").events[0]?.impactEnergy).toBeLessThan(
      make("terrain_alloy_frame").events[0]?.impactEnergy ?? 0,
    );
  });

  it("rejects empty, duplicate, and invalid collapse components", () => {
    const state = createTerrainState({
      width: 2,
      height: 2,
      fills: [{ x: 0, y: 1, width: 1, height: 1, materialId: "terrain_cloud_soil" }],
    });
    const base = {
      scope: "full" as const,
      supportedCellIndices: [],
      inspectedCellCount: 1,
      inspectedChunks: [{ x: 0, y: 0 }],
    };
    expect(() => resolveTerrainCollapse(state, { ...base, unstableComponents: [[]] })).toThrow(
      "cannot be empty",
    );
    expect(() =>
      resolveTerrainCollapse(state, { ...base, unstableComponents: [[2], [2]] }),
    ).toThrow("duplicate");
    expect(() => resolveTerrainCollapse(state, { ...base, unstableComponents: [[99]] })).toThrow(
      "invalid",
    );
    expect(() => resolveTerrainCollapse(state, { ...base, unstableComponents: [[0]] })).toThrow(
      "must be occupied",
    );
    expect(resolveTerrainCollapse(state, { ...base, unstableComponents: [] })).toEqual({
      state,
      events: [],
    });
  });

  it("orders multiple same-height components by stable cell index", () => {
    const state = createTerrainState({
      width: 8,
      height: 5,
      fills: [
        { x: 1, y: 3, width: 1, height: 1, materialId: "terrain_cloud_soil" },
        { x: 6, y: 3, width: 1, height: 1, materialId: "terrain_cloud_soil" },
      ],
    });
    const result = resolveTerrainCollapse(state, analyzeTerrainSupport(state, { scope: "full" }));
    expect(result.events.map((event) => event.sourceCellIndices[0])).toEqual([25, 30]);
  });
});
