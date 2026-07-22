import type { z } from "zod";

import {
  bossIdSchema,
  catalogSchemas,
  enemyIdSchema,
  localizationCatalogSchema,
  moduleIdSchema,
  robotIdSchema,
} from "./schemas.js";
import type { CatalogName, PveContentPack } from "./schemas.js";

export interface ContentIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ContentPackReport {
  readonly valid: boolean;
  readonly issues: readonly ContentIssue[];
  readonly counts: Readonly<Record<string, number>>;
}

export function parseCatalog(name: CatalogName, input: unknown): unknown {
  return catalogSchemas[name].parse(input);
}

export function parseLocalization(input: unknown): PveContentPack["localization"] {
  return localizationCatalogSchema.parse(input);
}

export function validateContentPack(pack: PveContentPack): ContentPackReport {
  const issues: ContentIssue[] = [];
  const versions = new Set([
    pack.robots.contentVersion,
    pack.modules.contentVersion,
    pack.enemies.contentVersion,
    pack.bosses.contentVersion,
    pack.objectives.contentVersion,
    pack.maps.contentVersion,
    pack.regions.contentVersion,
    pack.events.contentVersion,
    pack.routes.contentVersion,
    pack.tutorials.contentVersion,
    pack.progression.contentVersion,
  ]);
  if (versions.size !== 1)
    add(issues, "VERSION_MISMATCH", "contentVersion", "all catalogs must use one content version");

  requireExactIds(
    issues,
    "robots",
    pack.robots.robots.map((entry) => entry.id),
    robotIdSchema.options,
  );
  requireExactIds(
    issues,
    "modules",
    pack.modules.modules.map((entry) => entry.id),
    moduleIdSchema.options,
  );
  requireExactIds(
    issues,
    "enemies",
    pack.enemies.enemies.map((entry) => entry.id),
    enemyIdSchema.options,
  );
  requireExactIds(
    issues,
    "bosses",
    pack.bosses.bosses.map((entry) => entry.id),
    bossIdSchema.options,
  );

  uniqueById(issues, "objectives", pack.objectives.objectives);
  uniqueById(issues, "maps", pack.maps.maps);
  uniqueById(issues, "regions", pack.regions.regions);
  uniqueById(issues, "events", pack.events.events);
  uniqueById(issues, "rewardPool", pack.routes.rewardPool);
  uniqueById(issues, "tutorials", pack.tutorials.tutorials);
  uniqueById(issues, "unlocks", pack.progression.unlocks);
  uniqueById(issues, "achievements", pack.progression.achievements);
  uniqueById(issues, "compendiumEntries", pack.progression.compendiumEntries);

  const objectiveIds = new Set(pack.objectives.objectives.map((entry) => entry.id));
  const objectivesById = new Map(pack.objectives.objectives.map((entry) => [entry.id, entry]));
  const mapIds = new Set(pack.maps.maps.map((entry) => entry.id));
  const regionIds = new Set(pack.regions.regions.map((entry) => entry.id));
  const moduleById = new Map(pack.modules.modules.map((entry) => [entry.id, entry]));
  const routeOwners = new Map(
    pack.modules.modules.flatMap((module) =>
      module.routes.map((route) => [route.id, module.id] as const),
    ),
  );
  pack.robots.robots.forEach((robot, robotIndex) => {
    if (moduleById.get(robot.mainModuleId)?.class !== "main")
      add(
        issues,
        "ROBOT_MAIN_MODULE_INVALID",
        `robots[${robotIndex}].mainModuleId`,
        robot.mainModuleId,
      );
    robot.auxiliaryModuleIds.forEach((moduleId, moduleIndex) => {
      if (moduleById.get(moduleId)?.class !== "auxiliary")
        add(
          issues,
          "ROBOT_AUX_MODULE_INVALID",
          `robots[${robotIndex}].auxiliaryModuleIds[${moduleIndex}]`,
          moduleId,
        );
    });
  });
  pack.routes.rewardPool.forEach((reward, rewardIndex) => {
    if (reward.moduleId !== null && !moduleById.has(reward.moduleId))
      add(issues, "REWARD_MODULE_MISSING", `rewardPool[${rewardIndex}].moduleId`, reward.moduleId);
    if (reward.routeId !== null && routeOwners.get(reward.routeId) !== reward.moduleId)
      add(issues, "REWARD_ROUTE_MISMATCH", `rewardPool[${rewardIndex}].routeId`, reward.routeId);
    const validReferences =
      reward.kind === "module"
        ? reward.moduleId !== null && reward.routeId === null
        : reward.kind === "upgrade"
          ? reward.moduleId !== null && reward.routeId !== null
          : reward.moduleId === null && reward.routeId === null;
    if (!validReferences)
      add(
        issues,
        "REWARD_REFERENCE_INVALID",
        `rewardPool[${rewardIndex}]`,
        "reward references do not match its kind",
      );
    const validEffect =
      reward.kind === "temporary_mod"
        ? reward.temporaryEffect !== undefined
        : reward.temporaryEffect === undefined;
    if (!validEffect)
      add(
        issues,
        "REWARD_EFFECT_INVALID",
        `rewardPool[${rewardIndex}].temporaryEffect`,
        "temporary effect does not match reward kind",
      );
  });
  for (const [index, map] of pack.maps.maps.entries()) {
    if (!regionIds.has(map.regionId))
      add(issues, "REGION_REFERENCE_MISSING", `maps[${index}].regionId`, map.regionId);
    for (const [field, values] of [
      ["primaryObjectiveIds", map.primaryObjectiveIds],
      ["secondaryObjectiveIds", map.secondaryObjectiveIds],
      ["hiddenObjectiveIds", map.hiddenObjectiveIds],
    ] as const) {
      values.forEach((value, valueIndex) => {
        if (!objectiveIds.has(value))
          add(
            issues,
            "OBJECTIVE_REFERENCE_MISSING",
            `maps[${index}].${field}[${valueIndex}]`,
            value,
          );
        else {
          const expectedRole =
            field === "primaryObjectiveIds"
              ? "primary"
              : field === "secondaryObjectiveIds"
                ? "secondary"
                : "hidden";
          if (objectivesById.get(value)?.role !== expectedRole)
            add(issues, "OBJECTIVE_ROLE_MISMATCH", `maps[${index}].${field}[${valueIndex}]`, value);
        }
      });
    }
    const provided = new Set(map.providedCapabilities);
    map.requiredCapabilities.forEach((capability, capabilityIndex) => {
      if (!provided.has(capability))
        add(
          issues,
          "MAP_CAPABILITY_UNAVAILABLE",
          `maps[${index}].requiredCapabilities[${capabilityIndex}]`,
          capability,
        );
    });
    validateMapGeometry(issues, map, index);
  }
  pack.regions.regions.forEach((region, regionIndex) => {
    region.mapIds.forEach((mapId, mapIndex) => {
      if (!mapIds.has(mapId))
        add(issues, "MAP_REFERENCE_MISSING", `regions[${regionIndex}].mapIds[${mapIndex}]`, mapId);
    });
    const boss = pack.bosses.bosses.find((candidate) => candidate.id === region.bossId);
    if (boss?.regionIndex !== region.index || !region.mapIds.includes(boss.mapId))
      add(issues, "REGION_BOSS_MISMATCH", `regions[${regionIndex}].bossId`, region.bossId);
  });
  const ordinaryDurations = pack.routes.route.nodeDurationMinutes;
  const shortestRouteMinutes =
    pack.regions.regions.reduce((total, region) => {
      const shortestNodeMinutes = Math.min(
        ...region.nodePool.filter((type) => type !== "boss").map((type) => ordinaryDurations[type]),
      );
      return total + shortestNodeMinutes * 2;
    }, 0) +
    ordinaryDurations.boss * pack.regions.regions.length;
  const [minimumRouteMinutes, maximumRouteMinutes] = pack.routes.route.targetDurationMinutes;
  if (shortestRouteMinutes < minimumRouteMinutes || shortestRouteMinutes > maximumRouteMinutes)
    add(
      issues,
      "ROUTE_DURATION_UNREACHABLE",
      "routes.route.nodeDurationMinutes",
      `guaranteed route is ${shortestRouteMinutes} minutes, expected ${minimumRouteMinutes}-${maximumRouteMinutes}`,
    );
  const orderedRegionIndexes = pack.regions.regions
    .map((region) => region.index)
    .sort((left, right) => left - right);
  if (orderedRegionIndexes.some((value, index) => value !== index + 1))
    add(issues, "REGION_ORDER_INVALID", "regions", "region indexes must be 1 through 4");
  pack.events.events.forEach((event, eventIndex) => {
    event.regionIds.forEach((regionId, regionIndex) => {
      if (!regionIds.has(regionId))
        add(
          issues,
          "REGION_REFERENCE_MISSING",
          `events[${eventIndex}].regionIds[${regionIndex}]`,
          regionId,
        );
    });
  });
  const unlockTargets = new Set([
    ...pack.progression.initialRobotIds,
    ...pack.progression.initialModuleIds,
    ...pack.progression.initialRegionIds,
    ...pack.progression.unlocks.map((unlock) => unlock.targetId),
  ]);
  pack.progression.unlocks.forEach((unlock, unlockIndex) => {
    unlock.prerequisites.forEach((prerequisite, prerequisiteIndex) => {
      if (!unlockTargets.has(prerequisite))
        add(
          issues,
          "UNLOCK_PREREQUISITE_MISSING",
          `unlocks[${unlockIndex}].prerequisites[${prerequisiteIndex}]`,
          prerequisite,
        );
    });
  });

  const localizedKeys = collectLocalizationKeys(pack);
  localizedKeys.forEach(({ path, value }) => {
    if (pack.localization[value] === undefined)
      add(issues, "LOCALIZATION_KEY_MISSING", path, value);
  });
  const tutorialOrders = pack.tutorials.tutorials.map((entry) => entry.order).sort((a, b) => a - b);
  if (tutorialOrders.some((order, index) => order !== index + 1))
    add(issues, "TUTORIAL_ORDER_INVALID", "tutorials", "tutorial order must be 1 through 6");

  const primaryCount = pack.objectives.objectives.filter(
    (entry) => entry.role === "primary",
  ).length;
  const secondaryCount = pack.objectives.objectives.filter(
    (entry) => entry.role === "secondary",
  ).length;
  const hiddenCount = pack.objectives.objectives.filter((entry) => entry.role === "hidden").length;
  if (primaryCount < 7 || secondaryCount < 6 || hiddenCount < 5)
    add(
      issues,
      "OBJECTIVE_VARIETY_LOW",
      "objectives",
      "requires 7 primary, 6 secondary, and 5 hidden objective definitions",
    );

  issues.sort(
    (left, right) => left.code.localeCompare(right.code) || left.path.localeCompare(right.path),
  );
  return {
    valid: issues.length === 0,
    issues,
    counts: {
      achievements: pack.progression.achievements.length,
      bosses: pack.bosses.bosses.length,
      compendium: pack.progression.compendiumEntries.length,
      enemies: pack.enemies.enemies.length,
      events: pack.events.events.length,
      maps: pack.maps.maps.length,
      modules: pack.modules.modules.length,
      objectives: pack.objectives.objectives.length,
      regions: pack.regions.regions.length,
      rewards: pack.routes.rewardPool.length,
      robots: pack.robots.robots.length,
      tutorials: pack.tutorials.tutorials.length,
    },
  };
}

function requireExactIds(
  issues: ContentIssue[],
  path: string,
  actual: readonly string[],
  expected: readonly string[],
): void {
  const actualSet = new Set(actual);
  expected.forEach((value) => {
    if (!actualSet.has(value)) add(issues, "REQUIRED_ID_MISSING", path, value);
  });
  if (actualSet.size !== actual.length)
    add(issues, "DUPLICATE_ID", path, "catalog ids must be unique");
}

function uniqueById(
  issues: ContentIssue[],
  path: string,
  entries: readonly { readonly id: string }[],
): void {
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
    add(issues, "DUPLICATE_ID", path, "catalog ids must be unique");
}

function validateMapGeometry(
  issues: ContentIssue[],
  map: PveContentPack["maps"]["maps"][number],
  index: number,
): void {
  const points = [...map.playerSpawns, ...map.enemySpawns, map.objectivePoint];
  const occupied = new Set<string>();
  points.forEach((point, pointIndex) => {
    if (point.x >= map.width || point.y >= map.height || point.y <= map.floorY)
      add(
        issues,
        "MAP_POINT_INVALID",
        `maps[${index}].points[${pointIndex}]`,
        "point must be above floor and inside bounds",
      );
    const key = `${point.x}:${point.y}`;
    if (occupied.has(key))
      add(issues, "MAP_POINT_OVERLAP", `maps[${index}].points[${pointIndex}]`, key);
    occupied.add(key);
  });
  map.fixedAnchorXs.forEach((value, anchorIndex) => {
    if (Number(value) >= map.width)
      add(issues, "MAP_ANCHOR_INVALID", `maps[${index}].fixedAnchorXs[${anchorIndex}]`, value);
  });
}

function collectLocalizationKeys(
  pack: PveContentPack,
): { readonly path: string; readonly value: string }[] {
  const result: { path: string; value: string }[] = [];
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        walk(entry, `${path}[${index}]`);
      });
    } else if (typeof value === "object" && value !== null) {
      Object.entries(value).forEach(([field, entry]) => {
        if (field.endsWith("Key") && typeof entry === "string")
          result.push({ path: `${path}.${field}`, value: entry });
        else if (field.endsWith("Keys") && Array.isArray(entry)) {
          entry.forEach((item, index) => {
            if (typeof item === "string")
              result.push({ path: `${path}.${field}[${index}]`, value: item });
          });
        } else walk(entry, `${path}.${field}`);
      });
    }
  };
  for (const [name, catalog] of Object.entries(pack)) {
    if (name !== "localization") walk(catalog, name);
  }
  return result;
}

function add(issues: ContentIssue[], code: string, path: string, message: string): void {
  issues.push({ code, path, message });
}

export function formatZodIssues(error: z.ZodError): ContentIssue[] {
  return error.issues.map((issue) => ({
    code: "SCHEMA_INVALID",
    path: issue.path.join("."),
    message: issue.message,
  }));
}
