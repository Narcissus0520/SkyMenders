import { describe, expect, it } from "vitest";

import {
  clearTerrainDirtyChunks,
  createTerrainState,
  executeTerrainOperations,
  getTerrainCell,
} from "../src/index.js";

describe("terrain operation replay", () => {
  it("checkpoints damage, repair, and no-op collapse in order", () => {
    const initial = clearTerrainDirtyChunks(createTerrainState({ width: 4, height: 4 }));
    const execution = executeTerrainOperations(initial, [
      {
        kind: "repair",
        command: {
          x: 1,
          y: 1,
          materialId: "terrain_cloud_soil",
          amount: 500,
          availableEnergy: 175,
        },
      },
      { kind: "damage", command: { x: 1, y: 1, radius: 0, energy: 100 } },
      { kind: "resolve_collapse" },
    ]);
    expect(execution.checkpoints.map((checkpoint) => checkpoint.operationIndex)).toEqual([0, 1, 2]);
    expect(execution.supportAnalyses).toHaveLength(1);
    expect(execution.collapseEvents[0]?.outcome).toBe("lost");
    expect(getTerrainCell(execution.finalState, 1, 1)).toBeNull();
  });

  it("returns the validated initial state for an empty operation log", () => {
    const initial = createTerrainState({ width: 1, height: 1 });
    expect(executeTerrainOperations(initial, [])).toEqual({
      finalState: initial,
      checkpoints: [],
      materialEffects: [],
      collapseEvents: [],
      supportAnalyses: [],
    });
  });

  it("fails closed for oversized and unknown operation logs", () => {
    const initial = createTerrainState({ width: 2, height: 2 });
    expect(() =>
      executeTerrainOperations(
        initial,
        Array.from({ length: 10_001 }, () => ({ kind: "resolve_collapse" })),
      ),
    ).toThrow("cannot exceed 10000 entries");
    expect(() => executeTerrainOperations(initial, [{ kind: "unknown" }] as never)).toThrow(
      "unsupported terrain operation kind: unknown",
    );
  });
});
