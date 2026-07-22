import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  bossCatalogSchema,
  enemyCatalogSchema,
  eventCatalogSchema,
  localizationCatalogSchema,
  mapCatalogSchema,
  moduleCatalogSchema,
  objectiveCatalogSchema,
  progressionCatalogSchema,
  regionCatalogSchema,
  robotCatalogSchema,
  routeCatalogSchema,
  tutorialCatalogSchema,
} from "@skymenders/content-schema";
import { describe, expect, it } from "vitest";

import { PveFlowModel } from "../assets/scripts/pve/PveFlowModel.js";

const root = resolve(import.meta.dirname, "../../../content");
const read = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(root, path), "utf8")) as unknown;
const pack = {
  robots: robotCatalogSchema.parse(read("robots/catalog.json")),
  modules: moduleCatalogSchema.parse(read("modules/catalog.json")),
  enemies: enemyCatalogSchema.parse(read("enemies/catalog.json")),
  bosses: bossCatalogSchema.parse(read("bosses/catalog.json")),
  objectives: objectiveCatalogSchema.parse(read("objectives/catalog.json")),
  maps: mapCatalogSchema.parse(read("maps/catalog.json")),
  regions: regionCatalogSchema.parse(read("regions/catalog.json")),
  events: eventCatalogSchema.parse(read("events/catalog.json")),
  routes: routeCatalogSchema.parse(read("routes/catalog.json")),
  tutorials: tutorialCatalogSchema.parse(read("tutorials/catalog.json")),
  progression: progressionCatalogSchema.parse(read("progression/catalog.json")),
  localization: localizationCatalogSchema.parse(read("localization/zh-CN.json")),
};

describe("PvE client flow", () => {
  it("presents route state, node completion, and locked rewards without owning battle authority", () => {
    const model = new PveFlowModel(pack);
    expect(() => model.view()).toThrow("not started");
    expect(() => model.rewards([], [])).toThrow("completed node");
    const started = model.start(42, ["robot_rivet", "robot_anchor", "robot_gale"]);
    expect(started).toMatchObject({
      status: "active",
      regionIndex: 1,
      layer: 0,
      completedNodes: 0,
    });
    const node = started.availableNodes[0];
    if (node === undefined) throw new Error("node missing");
    const next = model.completeNode(node.id, {
      victory: true,
      robotHp: {},
      structuralDamage: {},
      researchEarned: 3,
      suppliesEarned: 2,
    });
    expect(next).toMatchObject({ layer: 1, completedNodes: 1 });
    expect(
      model.rewards(pack.progression.initialModuleIds, ["main_fold_bridge"]).choices,
    ).toHaveLength(3);
  });
});
