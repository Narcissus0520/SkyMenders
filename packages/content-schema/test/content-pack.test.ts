import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  catalogSchemas,
  formatZodIssues,
  localizationCatalogSchema,
  parseCatalog,
  parseLocalization,
  validateContentPack,
} from "../src/index.js";
import type { CatalogName, PveContentPack } from "../src/index.js";

const contentRoot = resolve(import.meta.dirname, "../../../content");

function read(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(contentRoot, relativePath), "utf8")) as unknown;
}

function loadPack(): PveContentPack {
  return {
    robots: catalogSchemas.robots.parse(read("robots/catalog.json")),
    modules: catalogSchemas.modules.parse(read("modules/catalog.json")),
    enemies: catalogSchemas.enemies.parse(read("enemies/catalog.json")),
    bosses: catalogSchemas.bosses.parse(read("bosses/catalog.json")),
    objectives: catalogSchemas.objectives.parse(read("objectives/catalog.json")),
    maps: catalogSchemas.maps.parse(read("maps/catalog.json")),
    regions: catalogSchemas.regions.parse(read("regions/catalog.json")),
    events: catalogSchemas.events.parse(read("events/catalog.json")),
    routes: catalogSchemas.routes.parse(read("routes/catalog.json")),
    tutorials: catalogSchemas.tutorials.parse(read("tutorials/catalog.json")),
    progression: catalogSchemas.progression.parse(read("progression/catalog.json")),
    localization: localizationCatalogSchema.parse(read("localization/zh-CN.json")),
  };
}

describe("PvE content schema", () => {
  it("parses and cross-validates the complete authored pack", () => {
    const pack = loadPack();
    const report = validateContentPack(pack);
    expect(report).toMatchObject({
      valid: true,
      counts: { robots: 6, modules: 18, enemies: 8, bosses: 4, regions: 4, maps: 16, tutorials: 6 },
    });
    expect(report.issues).toEqual([]);
    expect(parseCatalog("robots", read("robots/catalog.json"))).toEqual(pack.robots);
    expect(parseLocalization(read("localization/zh-CN.json"))).toEqual(pack.localization);
  });

  it("rejects malformed catalog shapes and formats schema failures", () => {
    for (const name of Object.keys(catalogSchemas) as CatalogName[]) {
      expect(() => parseCatalog(name, { schemaVersion: "bad" })).toThrow(z.ZodError);
    }
    expect(() => parseLocalization({ "Bad Key": "value" })).toThrow(z.ZodError);
    const failure = catalogSchemas.robots.safeParse({ schemaVersion: "bad" });
    expect(failure.success).toBe(false);
    if (!failure.success)
      expect(formatZodIssues(failure.error)[0]).toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("reports broken cross references, geometry, IDs, versions, localization, and minimum variety", () => {
    const pack = loadPack();
    const firstMap = pack.maps.maps[0];
    const firstRegion = pack.regions.regions[0];
    const firstEvent = pack.events.events[0];
    if (firstMap === undefined || firstRegion === undefined || firstEvent === undefined)
      throw new Error("fixture missing");
    const invalid = {
      ...pack,
      modules: {
        ...pack.modules,
        contentVersion: "0.1.1",
        modules: [...pack.modules.modules.slice(0, -1), pack.modules.modules[0]],
      },
      objectives: {
        ...pack.objectives,
        objectives: pack.objectives.objectives
          .filter((entry) => entry.role === "primary")
          .slice(0, 2),
      },
      maps: {
        ...pack.maps,
        maps: [
          {
            ...firstMap,
            regionId: "region_missing",
            providedCapabilities: [],
            requiredCapabilities: ["repair"],
            playerSpawns: [
              { x: firstMap.width, y: firstMap.floorY },
              firstMap.playerSpawns[0],
              firstMap.playerSpawns[0],
            ],
            fixedAnchorXs: [String(firstMap.width), "1"],
            primaryObjectiveIds: ["missing_primary"],
            secondaryObjectiveIds: ["missing_secondary"],
            hiddenObjectiveIds: ["missing_hidden"],
            nameKey: "missing.localization.key",
          },
          firstMap,
        ],
      },
      regions: {
        ...pack.regions,
        regions: [
          { ...firstRegion, mapIds: ["missing_map", ...firstRegion.mapIds.slice(1)] },
          ...pack.regions.regions.slice(1),
        ],
      },
      events: {
        ...pack.events,
        events: [{ ...firstEvent, regionIds: ["missing_region"] }, ...pack.events.events.slice(1)],
      },
      tutorials: {
        ...pack.tutorials,
        tutorials: pack.tutorials.tutorials.map((tutorial) => ({ ...tutorial, order: 1 })),
      },
      routes: {
        ...pack.routes,
        rewardPool: pack.routes.rewardPool.map((reward, index) =>
          index === 0
            ? {
                ...reward,
                moduleId: null,
                temporaryEffect: { kind: "energy_maximum_bonus", amount: 1 },
              }
            : reward,
        ),
        route: {
          ...pack.routes.route,
          nodeDurationMinutes: {
            battle: 10,
            engineering: 10,
            elite: 10,
            event: 10,
            workshop: 10,
            supply: 10,
            boss: 10,
          },
        },
      },
      progression: {
        ...pack.progression,
        achievements: [pack.progression.achievements[0], pack.progression.achievements[0]],
        compendiumEntries: [
          pack.progression.compendiumEntries[0],
          pack.progression.compendiumEntries[0],
        ],
      },
      localization: {},
    } as unknown as PveContentPack;
    const report = validateContentPack(invalid);
    const codes = new Set(report.issues.map((issue) => issue.code));
    expect(report.valid).toBe(false);
    for (const code of [
      "VERSION_MISMATCH",
      "REQUIRED_ID_MISSING",
      "DUPLICATE_ID",
      "REGION_REFERENCE_MISSING",
      "REWARD_EFFECT_INVALID",
      "REWARD_REFERENCE_INVALID",
      "ROUTE_DURATION_UNREACHABLE",
      "OBJECTIVE_REFERENCE_MISSING",
      "MAP_CAPABILITY_UNAVAILABLE",
      "MAP_POINT_INVALID",
      "MAP_POINT_OVERLAP",
      "MAP_ANCHOR_INVALID",
      "MAP_REFERENCE_MISSING",
      "LOCALIZATION_KEY_MISSING",
      "TUTORIAL_ORDER_INVALID",
      "OBJECTIVE_VARIETY_LOW",
    ])
      expect(codes).toContain(code);
  });
});
