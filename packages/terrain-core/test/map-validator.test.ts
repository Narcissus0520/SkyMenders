import { describe, expect, it } from "vitest";

import { createTerrainState, validateTerrainMap } from "../src/index.js";
import type { TerrainMapDefinition } from "../src/index.js";

function validMap(): TerrainMapDefinition {
  const terrain = createTerrainState({
    width: 8,
    height: 4,
    fills: [{ x: 0, y: 0, width: 8, height: 1, materialId: "terrain_alloy_frame" }],
    supportRoots: [{ id: "anchor", kind: "fixed_anchor", x: 0, y: 0, capacity: 100_000 }],
  });
  return {
    mapId: "map:valid",
    terrain,
    playerSpawns: [{ x: 1, y: 1 }],
    enemySpawns: [{ x: 6, y: 1 }],
    objectives: [
      {
        id: "objective:tower",
        position: { x: 4, y: 1 },
        supportCell: { x: 4, y: 0 },
        accessPoint: { x: 4, y: 1 },
      },
    ],
    keyEngagementPoints: [{ x: 3, y: 1 }],
    navigationCells: Array.from({ length: 6 }, (_, index) => ({ x: index + 1, y: 1 })),
    requiredCapabilities: ["basic_repair"],
    availableCapabilities: ["basic_repair"],
    cameraBounds: { minimumX: 0, minimumY: 0, maximumX: 7, maximumY: 3 },
  };
}

describe("terrain map validation", () => {
  it("accepts a supported, reachable, camera-covered map", () => {
    const result = validateTerrainMap(validMap());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.metrics).toEqual({
      occupiedCells: 8,
      supportedCells: 8,
      unstableCells: 0,
      navigationCells: 6,
    });
  });

  it("reports actionable spawn, objective, route, capability, and camera errors", () => {
    const map = validMap();
    const objective = map.objectives[0];
    if (objective === undefined) throw new Error("valid map fixture must have an objective");
    const result = validateTerrainMap({
      ...map,
      playerSpawns: [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ],
      objectives: [
        {
          ...objective,
          supportCell: { x: 4, y: 2 },
          accessPoint: { x: 7, y: 3 },
        },
      ],
      navigationCells: [...map.navigationCells, { x: 2, y: 0 }],
      requiredCapabilities: ["gravity_control"],
      cameraBounds: { minimumX: 0, minimumY: 0, maximumX: 3, maximumY: 3 },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "CAMERA_COVERAGE_MISSING",
        "CAPABILITY_UNAVAILABLE",
        "COMPLETION_PATH_MISSING",
        "NAVIGATION_BLOCKED",
        "OBJECTIVE_UNSUPPORTED",
        "SPAWN_OVERLAP",
      ]),
    );
  });

  it("rejects whole-map first-frame collapse and unreachable AI zones", () => {
    const map = validMap();
    const unsupported = createTerrainState({
      width: 8,
      height: 4,
      fills: [{ x: 0, y: 0, width: 8, height: 1, materialId: "terrain_cloud_soil" }],
    });
    const result = validateTerrainMap({
      ...map,
      terrain: unsupported,
      enemySpawns: [],
    });
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "AI_ENGAGEMENT_UNREACHABLE",
        "OBJECTIVE_UNSUPPORTED",
        "SPAWN_NOT_STANDABLE",
        "TERRAIN_WHOLE_MAP_COLLAPSE",
      ]),
    );
  });

  it("returns a readable report for an invalid terrain envelope", () => {
    const map = validMap();
    const result = validateTerrainMap({
      ...map,
      terrain: { ...map.terrain, terrainSchemaVersion: "9.9.9" },
    });
    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        issues: [expect.objectContaining({ code: "TERRAIN_STATE_INVALID", path: "terrain" })],
      }),
    );
  });

  it("reports malformed template metadata and partial instability", () => {
    const map = validMap();
    const floatingIndex = 3 * map.terrain.width + 7;
    const detached = {
      ...map.terrain,
      materials: map.terrain.materials.map((material, index) =>
        index === 0 ? 0 : index === floatingIndex ? 1 : material,
      ),
      integrities: map.terrain.integrities.map((integrity, index) =>
        index === 0 ? 0 : index === floatingIndex ? 1_000 : integrity,
      ),
      supportRoots: [
        ...map.terrain.supportRoots,
        { id: "anchor:active", kind: "fixed_anchor", x: 1, y: 0, capacity: 100_000 },
      ],
    };
    const result = validateTerrainMap({
      ...map,
      mapId: "bad map id",
      terrain: detached,
      playerSpawns: [],
      objectives: [
        {
          id: "bad id",
          position: { x: 99, y: 99 },
          supportCell: { x: 99, y: 99 },
          accessPoint: { x: 99, y: 99 },
        },
        {
          id: "bad id",
          position: { x: 4, y: 1 },
          supportCell: { x: 4, y: 0 },
          accessPoint: { x: 4, y: 1 },
        },
      ],
      navigationCells: [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
        { x: 99, y: 99 },
      ],
      cameraBounds: { minimumX: 5, minimumY: 0, maximumX: 3, maximumY: 99 },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "CAMERA_BOUNDS_INVALID",
        "MAP_ID_INVALID",
        "NAVIGATION_DUPLICATE",
        "NAVIGATION_OUT_OF_BOUNDS",
        "OBJECTIVE_ID_INVALID",
        "OBJECTIVE_POINT_OUT_OF_BOUNDS",
        "PLAYER_SPAWN_MISSING",
        "SUPPORT_ROOT_DETACHED",
        "TERRAIN_INITIAL_INSTABILITY",
      ]),
    );
  });

  it("reports missing objectives and blocked ground-level spawns", () => {
    const map = validMap();
    const result = validateTerrainMap({
      ...map,
      playerSpawns: [{ x: 1, y: 0 }],
      objectives: [],
      keyEngagementPoints: [],
    });
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["OBJECTIVE_MISSING", "SPAWN_NOT_STANDABLE"]),
    );
  });
});
