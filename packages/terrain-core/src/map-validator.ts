import { assertTerrainState, isTerrainPointInBounds, terrainIndex } from "./grid.js";
import { analyzeTerrainSupport } from "./support.js";
import type {
  GridPoint,
  MapValidationIssue,
  TerrainMapDefinition,
  TerrainMapValidationReport,
  TerrainState,
} from "./types.js";

const MAP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

export function validateTerrainMap(definition: TerrainMapDefinition): TerrainMapValidationReport {
  const issues: MapValidationIssue[] = [];
  try {
    assertTerrainState(definition.terrain);
  } catch (error) {
    issues.push({
      code: "TERRAIN_STATE_INVALID",
      severity: "error",
      path: "terrain",
      message: error instanceof Error ? error.message : "terrain state is invalid",
    });
    return report(definition.mapId, issues, 0, 0, 0, definition.navigationCells.length);
  }

  if (!MAP_ID_PATTERN.test(definition.mapId) || definition.mapId.length > 128) {
    addIssue(issues, "MAP_ID_INVALID", "mapId", "map id must use the identifier format");
  }
  const terrain = definition.terrain;
  const analysis = analyzeTerrainSupport(terrain, { scope: "full" });
  const supported = new Set(analysis.supportedCellIndices);
  const unstableCells = analysis.unstableComponents.reduce(
    (count, component) => count + component.length,
    0,
  );
  const occupiedCells = terrain.materials.reduce<number>(
    (count, material) => count + (material === 0 ? 0 : 1),
    0,
  );

  validateCameraBounds(definition, issues);
  terrain.supportRoots.forEach((root, index) => {
    if (terrain.materials[terrainIndex(terrain.width, root.x, root.y)] === 0) {
      addIssue(
        issues,
        "SUPPORT_ROOT_DETACHED",
        `terrain.supportRoots[${index}]`,
        `support root ${root.id} is not attached to occupied terrain`,
      );
    }
  });
  validateSpawns(definition, supported, issues);
  validateObjectives(definition, supported, issues);
  validateCapabilities(definition, issues);
  const navigation = validateNavigation(definition, issues);
  validateCompletionPaths(definition, navigation, issues);
  validateAiReachability(definition, navigation, issues);
  validateCameraCoverage(definition, issues);

  if (occupiedCells > 0 && unstableCells === occupiedCells) {
    addIssue(
      issues,
      "TERRAIN_WHOLE_MAP_COLLAPSE",
      "terrain",
      "all occupied terrain is unsupported at battle start",
    );
  } else if (unstableCells > 0) {
    addIssue(
      issues,
      "TERRAIN_INITIAL_INSTABILITY",
      "terrain",
      `${unstableCells} terrain cells will enter the initial collapse queue`,
      "warning",
    );
  }

  return report(
    definition.mapId,
    issues,
    occupiedCells,
    supported.size,
    unstableCells,
    navigation.size,
  );
}

function validateSpawns(
  definition: TerrainMapDefinition,
  supported: ReadonlySet<number>,
  issues: MapValidationIssue[],
): void {
  if (definition.playerSpawns.length === 0) {
    addIssue(
      issues,
      "PLAYER_SPAWN_MISSING",
      "playerSpawns",
      "at least one player spawn is required",
    );
  }
  const occupiedSpawnPoints = new Set<string>();
  const groups = [
    ["playerSpawns", definition.playerSpawns],
    ["enemySpawns", definition.enemySpawns],
  ] as const;
  for (const [path, spawns] of groups) {
    spawns.forEach((spawn, index) => {
      const itemPath = `${path}[${index}]`;
      if (!isTerrainPointInBounds(definition.terrain, spawn.x, spawn.y)) {
        addIssue(issues, "SPAWN_OUT_OF_BOUNDS", itemPath, "spawn must be inside terrain bounds");
        return;
      }
      const key = pointKey(spawn);
      if (occupiedSpawnPoints.has(key)) {
        addIssue(issues, "SPAWN_OVERLAP", itemPath, `spawn overlaps another spawn at ${key}`);
      }
      occupiedSpawnPoints.add(key);
      if (!isStandable(definition.terrain, spawn, supported)) {
        addIssue(
          issues,
          "SPAWN_NOT_STANDABLE",
          itemPath,
          "spawn must be empty with a supported terrain cell directly below",
        );
      }
    });
  }
}

function validateObjectives(
  definition: TerrainMapDefinition,
  supported: ReadonlySet<number>,
  issues: MapValidationIssue[],
): void {
  if (definition.objectives.length === 0) {
    addIssue(issues, "OBJECTIVE_MISSING", "objectives", "at least one objective is required");
  }
  const ids = new Set<string>();
  definition.objectives.forEach((objective, index) => {
    const path = `objectives[${index}]`;
    if (!MAP_ID_PATTERN.test(objective.id) || ids.has(objective.id)) {
      addIssue(
        issues,
        "OBJECTIVE_ID_INVALID",
        `${path}.id`,
        "objective id is invalid or duplicated",
      );
    }
    ids.add(objective.id);
    for (const [field, point] of [
      ["position", objective.position],
      ["supportCell", objective.supportCell],
      ["accessPoint", objective.accessPoint],
    ] as const) {
      if (!isTerrainPointInBounds(definition.terrain, point.x, point.y)) {
        addIssue(
          issues,
          "OBJECTIVE_POINT_OUT_OF_BOUNDS",
          `${path}.${field}`,
          `${field} is outside terrain`,
        );
      }
    }
    if (
      isTerrainPointInBounds(definition.terrain, objective.supportCell.x, objective.supportCell.y)
    ) {
      const supportIndex = terrainIndex(
        definition.terrain.width,
        objective.supportCell.x,
        objective.supportCell.y,
      );
      if (!supported.has(supportIndex)) {
        addIssue(
          issues,
          "OBJECTIVE_UNSUPPORTED",
          `${path}.supportCell`,
          "objective support cell is empty or will collapse at battle start",
        );
      }
    }
  });
}

function validateCapabilities(
  definition: TerrainMapDefinition,
  issues: MapValidationIssue[],
): void {
  const available = new Set(definition.availableCapabilities);
  for (const [index, capability] of definition.requiredCapabilities.entries()) {
    if (!available.has(capability)) {
      addIssue(
        issues,
        "CAPABILITY_UNAVAILABLE",
        `requiredCapabilities[${index}]`,
        `required capability ${capability} is neither owned nor provided by the map`,
      );
    }
  }
}

function validateNavigation(
  definition: TerrainMapDefinition,
  issues: MapValidationIssue[],
): Set<string> {
  const navigation = new Set<string>();
  definition.navigationCells.forEach((point, index) => {
    const path = `navigationCells[${index}]`;
    if (!isTerrainPointInBounds(definition.terrain, point.x, point.y)) {
      addIssue(issues, "NAVIGATION_OUT_OF_BOUNDS", path, "navigation cell is outside terrain");
      return;
    }
    const key = pointKey(point);
    if (navigation.has(key)) {
      addIssue(issues, "NAVIGATION_DUPLICATE", path, `duplicate navigation cell ${key}`);
      return;
    }
    navigation.add(key);
    if (
      definition.terrain.materials[terrainIndex(definition.terrain.width, point.x, point.y)] !== 0
    ) {
      addIssue(issues, "NAVIGATION_BLOCKED", path, "navigation cell must not contain terrain");
    }
  });
  return navigation;
}

function validateCompletionPaths(
  definition: TerrainMapDefinition,
  navigation: ReadonlySet<string>,
  issues: MapValidationIssue[],
): void {
  const reachable = reachableNavigation(definition.playerSpawns, navigation);
  definition.objectives.forEach((objective, index) => {
    const accessKey = pointKey(objective.accessPoint);
    if (!navigation.has(accessKey) || !reachable.has(accessKey)) {
      addIssue(
        issues,
        "COMPLETION_PATH_MISSING",
        `objectives[${index}].accessPoint`,
        `no legal navigation path reaches objective ${objective.id}`,
      );
    }
  });
}

function validateAiReachability(
  definition: TerrainMapDefinition,
  navigation: ReadonlySet<string>,
  issues: MapValidationIssue[],
): void {
  const reachable = reachableNavigation(definition.enemySpawns, navigation);
  definition.keyEngagementPoints.forEach((point, index) => {
    const key = pointKey(point);
    if (!navigation.has(key) || !reachable.has(key)) {
      addIssue(
        issues,
        "AI_ENGAGEMENT_UNREACHABLE",
        `keyEngagementPoints[${index}]`,
        "no enemy spawn can reach this key engagement point",
      );
    }
  });
}

function validateCameraBounds(
  definition: TerrainMapDefinition,
  issues: MapValidationIssue[],
): void {
  const bounds = definition.cameraBounds;
  if (
    !Number.isSafeInteger(bounds.minimumX) ||
    !Number.isSafeInteger(bounds.minimumY) ||
    !Number.isSafeInteger(bounds.maximumX) ||
    !Number.isSafeInteger(bounds.maximumY) ||
    bounds.minimumX < 0 ||
    bounds.minimumY < 0 ||
    bounds.maximumX >= definition.terrain.width ||
    bounds.maximumY >= definition.terrain.height ||
    bounds.minimumX > bounds.maximumX ||
    bounds.minimumY > bounds.maximumY
  ) {
    addIssue(
      issues,
      "CAMERA_BOUNDS_INVALID",
      "cameraBounds",
      "camera bounds must be ordered inside terrain",
    );
  }
}

function validateCameraCoverage(
  definition: TerrainMapDefinition,
  issues: MapValidationIssue[],
): void {
  const importantPoints = [
    ...definition.playerSpawns.map((point, index) => ({ point, path: `playerSpawns[${index}]` })),
    ...definition.enemySpawns.map((point, index) => ({ point, path: `enemySpawns[${index}]` })),
    ...definition.objectives.map((objective, index) => ({
      point: objective.position,
      path: `objectives[${index}].position`,
    })),
    ...definition.keyEngagementPoints.map((point, index) => ({
      point,
      path: `keyEngagementPoints[${index}]`,
    })),
  ];
  for (const important of importantPoints) {
    if (!cameraContains(definition, important.point)) {
      addIssue(
        issues,
        "CAMERA_COVERAGE_MISSING",
        important.path,
        "important point lies outside camera bounds",
      );
    }
  }
}

function isStandable(
  terrain: TerrainState,
  point: GridPoint,
  supported: ReadonlySet<number>,
): boolean {
  if (terrain.materials[terrainIndex(terrain.width, point.x, point.y)] !== 0 || point.y === 0) {
    return false;
  }
  return supported.has(terrainIndex(terrain.width, point.x, point.y - 1));
}

function reachableNavigation(
  starts: readonly GridPoint[],
  navigation: ReadonlySet<string>,
): Set<string> {
  const reached = new Set<string>();
  const queue: GridPoint[] = [];
  for (const start of starts) {
    const key = pointKey(start);
    if (!navigation.has(key) || reached.has(key)) continue;
    reached.add(key);
    queue.push(start);
  }
  let cursor = 0;
  while (cursor < queue.length) {
    const point = queue[cursor];
    cursor += 1;
    if (point === undefined) continue;
    for (const neighbor of [
      { x: point.x, y: point.y - 1 },
      { x: point.x - 1, y: point.y },
      { x: point.x + 1, y: point.y },
      { x: point.x, y: point.y + 1 },
    ]) {
      const key = pointKey(neighbor);
      if (!navigation.has(key) || reached.has(key)) continue;
      reached.add(key);
      queue.push(neighbor);
    }
  }
  return reached;
}

function cameraContains(definition: TerrainMapDefinition, point: GridPoint): boolean {
  const bounds = definition.cameraBounds;
  return (
    point.x >= bounds.minimumX &&
    point.x <= bounds.maximumX &&
    point.y >= bounds.minimumY &&
    point.y <= bounds.maximumY
  );
}

function pointKey(point: GridPoint): string {
  return `${point.x}:${point.y}`;
}

function addIssue(
  issues: MapValidationIssue[],
  code: string,
  path: string,
  message: string,
  severity: MapValidationIssue["severity"] = "error",
): void {
  issues.push({ code, severity, path, message });
}

function report(
  mapId: string,
  issues: MapValidationIssue[],
  occupiedCells: number,
  supportedCells: number,
  unstableCells: number,
  navigationCells: number,
): TerrainMapValidationReport {
  issues.sort(
    (left, right) =>
      compareText(left.code, right.code) ||
      compareText(left.path, right.path) ||
      compareText(left.message, right.message),
  );
  return {
    mapId,
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
    metrics: { occupiedCells, supportedCells, unstableCells, navigationCells },
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
