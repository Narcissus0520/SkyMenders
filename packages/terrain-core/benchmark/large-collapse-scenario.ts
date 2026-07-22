import {
  clearTerrainDirtyChunks,
  createTerrainState,
  executeTerrainOperations,
} from "../src/index.js";

export function executeLargeCollapseScenario() {
  const initial = clearTerrainDirtyChunks(
    createTerrainState({
      width: 192,
      height: 96,
      fills: [
        { x: 0, y: 48, width: 32, height: 8, materialId: "terrain_alloy_frame" },
        { x: 32, y: 50, width: 64, height: 1, materialId: "terrain_alloy_frame" },
        { x: 96, y: 45, width: 88, height: 25, materialId: "terrain_cloud_soil" },
      ],
      supportRoots: [{ id: "anchor:large", kind: "fixed_anchor", x: 0, y: 50, capacity: 100_000 }],
    }),
  );
  const execution = executeTerrainOperations(initial, [
    { kind: "damage", command: { x: 95, y: 50, radius: 0, energy: 10_000 } },
    { kind: "resolve_collapse" },
  ]);
  const analysis = execution.supportAnalyses[0];
  if (analysis === undefined) throw new Error("large collapse must produce support analysis");
  return {
    initial,
    analysis,
    collapse: { state: execution.finalState, events: execution.collapseEvents },
    execution,
  };
}
