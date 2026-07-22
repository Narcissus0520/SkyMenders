import { describe, expect, it } from "vitest";

import {
  AUXILIARY_MODULE_IDS,
  MAIN_MODULE_IDS,
  MODULE_DEFINITIONS,
  MODULE_IDS,
  MODULE_UPGRADE_ROUTE_IDS,
  getModuleDefinition,
  isModuleId,
  isModuleUpgradeRouteId,
  isRouteForModule,
  validateModuleLoadout,
} from "../src/index.js";

describe("module registry", () => {
  it("defines all 8 main and 10 auxiliary modules with two mechanical routes", () => {
    expect(MAIN_MODULE_IDS).toHaveLength(8);
    expect(AUXILIARY_MODULE_IDS).toHaveLength(10);
    expect(MODULE_IDS).toHaveLength(18);
    expect(new Set(MODULE_IDS).size).toBe(18);
    expect(MODULE_UPGRADE_ROUTE_IDS).toHaveLength(36);
    expect(new Set(MODULE_UPGRADE_ROUTE_IDS).size).toBe(36);
    for (const moduleId of MODULE_IDS) {
      const definition = getModuleDefinition(moduleId);
      expect(definition).toBe(MODULE_DEFINITIONS[moduleId]);
      expect(definition.routes).toHaveLength(2);
      expect(definition.routes.every((route) => isRouteForModule(moduleId, route.id))).toBe(true);
      expect(definition.routes.every((route) => route.mechanismKey !== route.tradeoffKey)).toBe(
        true,
      );
      expect(definition.energyCost).toBeGreaterThanOrEqual(
        definition.moduleClass === "main" ? 2 : 1,
      );
      expect(definition.energyCost).toBeLessThanOrEqual(definition.moduleClass === "main" ? 5 : 3);
    }
  });

  it("validates slot classes, duplicates, ownership, exclusivity, and route pairing", () => {
    expect(
      validateModuleLoadout({
        mainModuleId: "main_fold_bridge",
        auxiliaryModuleIds: ["aux_repair_spray", "aux_reflector"],
        selectedRoutes: [
          { moduleId: "main_fold_bridge", routeId: "fold_bridge_reinforced" },
          { moduleId: "aux_reflector", routeId: "reflector_prismatic" },
        ],
      }),
    ).toEqual([]);
    expect(
      validateModuleLoadout({
        mainModuleId: "aux_reflector",
        auxiliaryModuleIds: ["main_fold_bridge", "aux_reflector", "aux_reflector"],
        selectedRoutes: [
          { moduleId: "aux_jammer", routeId: "jammer_decoy" },
          { moduleId: "aux_reflector", routeId: "reflector_prismatic" },
          { moduleId: "aux_reflector", routeId: "jammer_silence" },
        ],
      }),
    ).toHaveLength(6);
  });

  it("fails type guards for unknown registry identifiers", () => {
    expect(isModuleId("main_unknown")).toBe(false);
    expect(isModuleUpgradeRouteId("route_unknown")).toBe(false);
    expect(isRouteForModule("main_fold_bridge", "drill_bee_precision")).toBe(false);
  });
});
