import { describe, expect, it } from "vitest";

import {
  TERRAIN_MAX_CELLS,
  addTerrainSupportRoot,
  applyTerrainDamage,
  applyTerrainRepair,
  assertTerrainState,
  clearTerrainDirtyChunks,
  createTerrainState,
  getTerrainCell,
  removeTerrainSupportRoot,
} from "../src/index.js";

describe("chunked terrain grid", () => {
  it("creates a bounded flat grid with deterministic chunk dirtiness", () => {
    const state = createTerrainState({
      width: 64,
      height: 33,
      fills: [{ x: 0, y: 0, width: 2, height: 1, materialId: "terrain_cloud_soil" }],
      supportRoots: [{ id: "anchor:1", kind: "fixed_anchor", x: 0, y: 0, capacity: 1_000 }],
    });
    expect(state.materials).toHaveLength(64 * 33);
    expect(state.dirtyChunks).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(getTerrainCell(state, 1, 0)).toEqual({
      materialId: "terrain_cloud_soil",
      integrity: 1_000,
    });
    expect(getTerrainCell(state, 2, 0)).toBeNull();
    expect(clearTerrainDirtyChunks(state).dirtyChunks).toEqual([]);
    expect(() => getTerrainCell(state, 64, 0)).toThrow("inside terrain bounds");
  });

  it("rejects invalid dimensions, fills, roots, and corrupted state", () => {
    expect(() => createTerrainState({ width: 0, height: 1 })).toThrow("dimensions");
    expect(() => createTerrainState({ width: TERRAIN_MAX_CELLS + 1, height: 1 })).toThrow(
      "cannot exceed",
    );
    expect(() =>
      createTerrainState({
        width: 2,
        height: 2,
        fills: [
          { x: 0, y: 0, width: 2, height: 1, materialId: "terrain_cloud_soil" },
          { x: 1, y: 0, width: 1, height: 1, materialId: "terrain_alloy_frame" },
        ],
      }),
    ).toThrow("overlap");
    expect(() =>
      createTerrainState({
        width: 2,
        height: 2,
        fills: [
          {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            materialId: "terrain_cloud_soil",
            integrity: 0,
          },
        ],
      }),
    ).toThrow("must be positive");
    expect(() =>
      createTerrainState({
        width: 2,
        height: 2,
        fills: [{ x: 1, y: 1, width: 2, height: 1, materialId: "terrain_cloud_soil" }],
      }),
    ).toThrow("rectangle");
    expect(() =>
      createTerrainState({
        width: 2,
        height: 2,
        supportRoots: [{ id: "anchor", kind: "fixed_anchor", x: 0, y: 0, capacity: 10 }],
      }),
    ).toThrow("occupied terrain");
    const state = createTerrainState({ width: 2, height: 2 });
    expect(() => {
      assertTerrainState({ ...state, materials: [0] });
    }).toThrow("match dimensions");
    expect(() => {
      assertTerrainState({ ...state, integrities: [1, 0, 0, 0] });
    }).toThrow("must agree");
    expect(() => {
      assertTerrainState({ ...state, chunkSize: 16 });
    }).toThrow("chunk size");
    expect(() => {
      assertTerrainState({ ...state, materials: [9, 0, 0, 0] as never });
    }).toThrow("material code");
    expect(() => {
      assertTerrainState({ ...state, integrities: new Array<number>(4) });
    }).toThrow("missing terrain integrity");
    expect(() => {
      assertTerrainState({ ...state, revision: -1 });
    }).toThrow("revision");
    expect(() => {
      assertTerrainState({ ...state, dirtyChunks: [{ x: 1, y: 0 }] });
    }).toThrow("dirty chunk");
    expect(() => {
      assertTerrainState({
        ...state,
        dirtyChunks: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      });
    }).toThrow("duplicate dirty chunk");
  });

  it("validates support root envelopes independently from attachment", () => {
    const occupied = createTerrainState({
      width: 3,
      height: 2,
      fills: [{ x: 0, y: 0, width: 3, height: 1, materialId: "terrain_alloy_frame" }],
    });
    expect(() => {
      assertTerrainState({
        ...occupied,
        supportRoots: [{ id: "bad id", kind: "fixed_anchor", x: 0, y: 0, capacity: 1 }],
      });
    }).toThrow("root id");
    expect(() => {
      assertTerrainState({
        ...occupied,
        supportRoots: [{ id: "root", kind: "unknown", x: 0, y: 0, capacity: 1 }],
      });
    }).toThrow("root kind");
    expect(() => {
      assertTerrainState({
        ...occupied,
        supportRoots: [{ id: "root", kind: "fixed_anchor", x: 0, y: 0, capacity: 0 }],
      });
    }).toThrow("capacity");
    expect(() => {
      assertTerrainState({
        ...occupied,
        supportRoots: [
          { id: "root", kind: "fixed_anchor", x: 0, y: 0, capacity: 1 },
          { id: "root", kind: "support_structure", x: 1, y: 0, capacity: 1 },
        ],
      });
    }).toThrow("duplicate support root");
    const sorted = createTerrainState({
      width: 3,
      height: 2,
      fills: [{ x: 0, y: 0, width: 3, height: 1, materialId: "terrain_alloy_frame" }],
      supportRoots: [
        { id: "z", kind: "fixed_anchor", x: 0, y: 0, capacity: 1 },
        { id: "a", kind: "support_structure", x: 1, y: 0, capacity: 1 },
      ],
    });
    expect(sorted.supportRoots.map((root) => root.id)).toEqual(["a", "z"]);
  });

  it("adds and removes temporary support structures without mutating fixed anchors", () => {
    const state = clearTerrainDirtyChunks(
      createTerrainState({
        width: 4,
        height: 2,
        fills: [{ x: 0, y: 0, width: 4, height: 1, materialId: "terrain_alloy_frame" }],
        supportRoots: [{ id: "anchor:fixed", kind: "fixed_anchor", x: 0, y: 0, capacity: 100 }],
      }),
    );
    const added = addTerrainSupportRoot(state, {
      id: "support:temporary",
      kind: "support_structure",
      x: 3,
      y: 0,
      capacity: 50,
    });
    expect(added.supportRoots.map((root) => root.id)).toEqual([
      "anchor:fixed",
      "support:temporary",
    ]);
    expect(added.revision).toBe(state.revision + 1);
    expect(added.dirtyChunks).toEqual([{ x: 0, y: 0 }]);
    expect(removeTerrainSupportRoot(added, "support:missing")).toBe(added);
    const removed = removeTerrainSupportRoot(added, "support:temporary");
    expect(removed.supportRoots).toEqual(state.supportRoots);
    expect(removed.revision).toBe(added.revision + 1);
    expect(() => {
      addTerrainSupportRoot(added, {
        id: "support:temporary",
        kind: "support_structure",
        x: 2,
        y: 0,
        capacity: 50,
      });
    }).toThrow("already exists");
    expect(() => {
      addTerrainSupportRoot(state, {
        id: "support:empty",
        kind: "support_structure",
        x: 1,
        y: 1,
        capacity: 50,
      });
    }).toThrow("occupied terrain");
    expect(() => {
      removeTerrainSupportRoot(state, "anchor:fixed");
    }).toThrow("fixed support root");
  });

  it("applies hardness, destruction effects, and seam-local dirty chunks", () => {
    const state = clearTerrainDirtyChunks(
      createTerrainState({
        width: 64,
        height: 4,
        fills: [
          { x: 30, y: 1, width: 1, height: 1, materialId: "terrain_cloud_soil" },
          { x: 31, y: 1, width: 1, height: 1, materialId: "terrain_energy_crystal" },
          { x: 32, y: 1, width: 1, height: 1, materialId: "terrain_alloy_frame" },
        ],
      }),
    );
    const softened = applyTerrainDamage(state, { x: 31, y: 1, radius: 1, energy: 100 });
    const soil = softened.affectedCells.find((cell) => cell.x === 30);
    const alloy = softened.affectedCells.find((cell) => cell.x === 32);
    expect(soil?.integrityAfter).toBeLessThan(alloy?.integrityAfter ?? 0);

    const destroyed = applyTerrainDamage(softened.state, {
      x: 31,
      y: 1,
      radius: 0,
      energy: 10_000,
    });
    expect(getTerrainCell(destroyed.state, 31, 1)).toBeNull();
    expect(destroyed.effects).toEqual([{ x: 31, y: 1, kind: "energy_release", amount: 4_000 }]);
    expect(destroyed.state.dirtyChunks).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(() => applyTerrainDamage(state, { x: 0, y: 0, radius: 65, energy: 1 })).toThrow(
      "radius",
    );
    expect(() => applyTerrainDamage(state, { x: 0, y: 0, radius: 0, energy: 0 })).toThrow("energy");
    expect(applyTerrainDamage(state, { x: 0, y: 0, radius: 0, energy: 1 }).state).toBe(state);
  });

  it("repairs or places compatible material using actual repair cost", () => {
    const empty = clearTerrainDirtyChunks(createTerrainState({ width: 4, height: 4 }));
    const repaired = applyTerrainRepair(empty, {
      x: 1,
      y: 1,
      materialId: "terrain_cloud_soil",
      amount: 500,
      availableEnergy: 175,
    });
    expect(repaired.energySpent).toBe(175);
    expect(repaired.repairedIntegrity).toBe(500);
    expect(getTerrainCell(repaired.state, 1, 1)?.integrity).toBe(500);
    const capped = applyTerrainRepair(repaired.state, {
      x: 1,
      y: 1,
      materialId: "terrain_cloud_soil",
      amount: 1_000,
      availableEnergy: 175,
    });
    expect(capped.repairedIntegrity).toBe(500);
    expect(getTerrainCell(capped.state, 1, 1)?.integrity).toBe(1_000);
    expect(
      applyTerrainRepair(capped.state, {
        x: 1,
        y: 1,
        materialId: "terrain_cloud_soil",
        amount: 1,
        availableEnergy: 0,
      }),
    ).toEqual({ state: capped.state, repairedIntegrity: 0, energySpent: 0 });
    expect(() =>
      applyTerrainRepair(empty, {
        x: 1,
        y: 1,
        materialId: "terrain_alloy_frame",
        amount: 1_000,
        availableEnergy: 100,
      }),
    ).toThrow("insufficient");
    expect(() =>
      applyTerrainRepair(repaired.state, {
        x: 1,
        y: 1,
        materialId: "terrain_alloy_frame",
        amount: 1,
        availableEnergy: 1,
      }),
    ).toThrow("different material");
    expect(() =>
      applyTerrainRepair(empty, {
        x: 1,
        y: 1,
        materialId: "terrain_cloud_soil",
        amount: 0,
        availableEnergy: 1,
      }),
    ).toThrow("repair amount");
    expect(() =>
      applyTerrainRepair(empty, {
        x: 1,
        y: 1,
        materialId: "terrain_cloud_soil",
        amount: 1,
        availableEnergy: -1,
      }),
    ).toThrow("available repair energy");
  });
});
