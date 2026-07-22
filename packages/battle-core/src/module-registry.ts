export const MAIN_MODULE_IDS = [
  "main_fold_bridge",
  "main_drill_bee",
  "main_magnetic_anchor",
  "main_gravity_pin",
  "main_bubble_capsule",
  "main_wind_generator",
  "main_support_frame",
  "main_energy_rail",
] as const;

export const AUXILIARY_MODULE_IDS = [
  "aux_repair_spray",
  "aux_reflector",
  "aux_ejector",
  "aux_stabilizer",
  "aux_route_scanner",
  "aux_energy_recycler",
  "aux_grapple",
  "aux_terrain_foam",
  "aux_jammer",
  "aux_structure_scanner",
] as const;

export const MODULE_IDS = [...MAIN_MODULE_IDS, ...AUXILIARY_MODULE_IDS] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export type MainModuleId = (typeof MAIN_MODULE_IDS)[number];
export type AuxiliaryModuleId = (typeof AUXILIARY_MODULE_IDS)[number];
export type ModuleClass = "main" | "auxiliary";
export type ModuleTargetMode = "point" | "actor" | "object" | "self_or_actor";

export const MODULE_UPGRADE_ROUTE_IDS = [
  "fold_bridge_reinforced",
  "fold_bridge_conductive",
  "drill_bee_deep_bore",
  "drill_bee_precision",
  "magnetic_anchor_heavy_pull",
  "magnetic_anchor_precision",
  "gravity_pin_inversion",
  "gravity_pin_rescue",
  "bubble_capsule_rescue",
  "bubble_capsule_rebound",
  "wind_generator_sustained",
  "wind_generator_turbine",
  "support_frame_fortified",
  "support_frame_mobile",
  "energy_rail_accelerator",
  "energy_rail_switchback",
  "repair_spray_unit_specialist",
  "repair_spray_terrain_specialist",
  "reflector_prismatic",
  "reflector_wide_guard",
  "ejector_tandem",
  "ejector_long_burn",
  "stabilizer_anchor",
  "stabilizer_counterforce",
  "route_scanner_deep_intel",
  "route_scanner_ballistic",
  "energy_recycler_team_loop",
  "energy_recycler_overclock",
  "grapple_rescue_line",
  "grapple_slingshot",
  "terrain_foam_reinforced",
  "terrain_foam_elastic",
  "jammer_decoy",
  "jammer_silence",
  "structure_scanner_predictive",
  "structure_scanner_salvage",
] as const;

export type ModuleUpgradeRouteId = (typeof MODULE_UPGRADE_ROUTE_IDS)[number];

export interface ModuleUpgradeRouteDefinition {
  readonly id: ModuleUpgradeRouteId;
  readonly mechanismKey: string;
  readonly conditionKey: string;
  readonly tradeoffKey: string;
}

export interface ModuleDefinition {
  readonly id: ModuleId;
  readonly nameKey: string;
  readonly moduleClass: ModuleClass;
  readonly energyCost: number;
  readonly cooldownRounds: number;
  readonly endsAction: boolean;
  readonly targetMode: ModuleTargetMode;
  readonly maximumRange: number;
  readonly routes: readonly [ModuleUpgradeRouteDefinition, ModuleUpgradeRouteDefinition];
}

function route(
  id: ModuleUpgradeRouteId,
  mechanismKey: string,
  conditionKey: string,
  tradeoffKey: string,
): ModuleUpgradeRouteDefinition {
  return { id, mechanismKey, conditionKey, tradeoffKey };
}

export const MODULE_DEFINITIONS: Readonly<Record<ModuleId, ModuleDefinition>> = Object.freeze({
  main_fold_bridge: {
    id: "main_fold_bridge",
    nameKey: "module.main_fold_bridge.name",
    moduleClass: "main",
    energyCost: 3,
    cooldownRounds: 1,
    endsAction: true,
    targetMode: "point",
    maximumRange: 5,
    routes: [
      route(
        "fold_bridge_reinforced",
        "module.route.fold_bridge_reinforced.mechanism",
        "module.route.fold_bridge_reinforced.condition",
        "module.route.fold_bridge_reinforced.tradeoff",
      ),
      route(
        "fold_bridge_conductive",
        "module.route.fold_bridge_conductive.mechanism",
        "module.route.fold_bridge_conductive.condition",
        "module.route.fold_bridge_conductive.tradeoff",
      ),
    ],
  },
  main_drill_bee: {
    id: "main_drill_bee",
    nameKey: "module.main_drill_bee.name",
    moduleClass: "main",
    energyCost: 4,
    cooldownRounds: 2,
    endsAction: true,
    targetMode: "point",
    maximumRange: 5,
    routes: [
      route(
        "drill_bee_deep_bore",
        "module.route.drill_bee_deep_bore.mechanism",
        "module.route.drill_bee_deep_bore.condition",
        "module.route.drill_bee_deep_bore.tradeoff",
      ),
      route(
        "drill_bee_precision",
        "module.route.drill_bee_precision.mechanism",
        "module.route.drill_bee_precision.condition",
        "module.route.drill_bee_precision.tradeoff",
      ),
    ],
  },
  main_magnetic_anchor: {
    id: "main_magnetic_anchor",
    nameKey: "module.main_magnetic_anchor.name",
    moduleClass: "main",
    energyCost: 3,
    cooldownRounds: 1,
    endsAction: true,
    targetMode: "object",
    maximumRange: 6,
    routes: [
      route(
        "magnetic_anchor_heavy_pull",
        "module.route.magnetic_anchor_heavy_pull.mechanism",
        "module.route.magnetic_anchor_heavy_pull.condition",
        "module.route.magnetic_anchor_heavy_pull.tradeoff",
      ),
      route(
        "magnetic_anchor_precision",
        "module.route.magnetic_anchor_precision.mechanism",
        "module.route.magnetic_anchor_precision.condition",
        "module.route.magnetic_anchor_precision.tradeoff",
      ),
    ],
  },
  main_gravity_pin: {
    id: "main_gravity_pin",
    nameKey: "module.main_gravity_pin.name",
    moduleClass: "main",
    energyCost: 5,
    cooldownRounds: 3,
    endsAction: true,
    targetMode: "point",
    maximumRange: 6,
    routes: [
      route(
        "gravity_pin_inversion",
        "module.route.gravity_pin_inversion.mechanism",
        "module.route.gravity_pin_inversion.condition",
        "module.route.gravity_pin_inversion.tradeoff",
      ),
      route(
        "gravity_pin_rescue",
        "module.route.gravity_pin_rescue.mechanism",
        "module.route.gravity_pin_rescue.condition",
        "module.route.gravity_pin_rescue.tradeoff",
      ),
    ],
  },
  main_bubble_capsule: {
    id: "main_bubble_capsule",
    nameKey: "module.main_bubble_capsule.name",
    moduleClass: "main",
    energyCost: 3,
    cooldownRounds: 2,
    endsAction: true,
    targetMode: "self_or_actor",
    maximumRange: 4,
    routes: [
      route(
        "bubble_capsule_rescue",
        "module.route.bubble_capsule_rescue.mechanism",
        "module.route.bubble_capsule_rescue.condition",
        "module.route.bubble_capsule_rescue.tradeoff",
      ),
      route(
        "bubble_capsule_rebound",
        "module.route.bubble_capsule_rebound.mechanism",
        "module.route.bubble_capsule_rebound.condition",
        "module.route.bubble_capsule_rebound.tradeoff",
      ),
    ],
  },
  main_wind_generator: {
    id: "main_wind_generator",
    nameKey: "module.main_wind_generator.name",
    moduleClass: "main",
    energyCost: 3,
    cooldownRounds: 2,
    endsAction: true,
    targetMode: "point",
    maximumRange: 6,
    routes: [
      route(
        "wind_generator_sustained",
        "module.route.wind_generator_sustained.mechanism",
        "module.route.wind_generator_sustained.condition",
        "module.route.wind_generator_sustained.tradeoff",
      ),
      route(
        "wind_generator_turbine",
        "module.route.wind_generator_turbine.mechanism",
        "module.route.wind_generator_turbine.condition",
        "module.route.wind_generator_turbine.tradeoff",
      ),
    ],
  },
  main_support_frame: {
    id: "main_support_frame",
    nameKey: "module.main_support_frame.name",
    moduleClass: "main",
    energyCost: 2,
    cooldownRounds: 1,
    endsAction: true,
    targetMode: "point",
    maximumRange: 4,
    routes: [
      route(
        "support_frame_fortified",
        "module.route.support_frame_fortified.mechanism",
        "module.route.support_frame_fortified.condition",
        "module.route.support_frame_fortified.tradeoff",
      ),
      route(
        "support_frame_mobile",
        "module.route.support_frame_mobile.mechanism",
        "module.route.support_frame_mobile.condition",
        "module.route.support_frame_mobile.tradeoff",
      ),
    ],
  },
  main_energy_rail: {
    id: "main_energy_rail",
    nameKey: "module.main_energy_rail.name",
    moduleClass: "main",
    energyCost: 4,
    cooldownRounds: 2,
    endsAction: true,
    targetMode: "point",
    maximumRange: 5,
    routes: [
      route(
        "energy_rail_accelerator",
        "module.route.energy_rail_accelerator.mechanism",
        "module.route.energy_rail_accelerator.condition",
        "module.route.energy_rail_accelerator.tradeoff",
      ),
      route(
        "energy_rail_switchback",
        "module.route.energy_rail_switchback.mechanism",
        "module.route.energy_rail_switchback.condition",
        "module.route.energy_rail_switchback.tradeoff",
      ),
    ],
  },
  aux_repair_spray: {
    id: "aux_repair_spray",
    nameKey: "module.aux_repair_spray.name",
    moduleClass: "auxiliary",
    energyCost: 2,
    cooldownRounds: 1,
    endsAction: false,
    targetMode: "self_or_actor",
    maximumRange: 3,
    routes: [
      route(
        "repair_spray_unit_specialist",
        "module.route.repair_spray_unit_specialist.mechanism",
        "module.route.repair_spray_unit_specialist.condition",
        "module.route.repair_spray_unit_specialist.tradeoff",
      ),
      route(
        "repair_spray_terrain_specialist",
        "module.route.repair_spray_terrain_specialist.mechanism",
        "module.route.repair_spray_terrain_specialist.condition",
        "module.route.repair_spray_terrain_specialist.tradeoff",
      ),
    ],
  },
  aux_reflector: {
    id: "aux_reflector",
    nameKey: "module.aux_reflector.name",
    moduleClass: "auxiliary",
    energyCost: 2,
    cooldownRounds: 2,
    endsAction: false,
    targetMode: "point",
    maximumRange: 3,
    routes: [
      route(
        "reflector_prismatic",
        "module.route.reflector_prismatic.mechanism",
        "module.route.reflector_prismatic.condition",
        "module.route.reflector_prismatic.tradeoff",
      ),
      route(
        "reflector_wide_guard",
        "module.route.reflector_wide_guard.mechanism",
        "module.route.reflector_wide_guard.condition",
        "module.route.reflector_wide_guard.tradeoff",
      ),
    ],
  },
  aux_ejector: {
    id: "aux_ejector",
    nameKey: "module.aux_ejector.name",
    moduleClass: "auxiliary",
    energyCost: 3,
    cooldownRounds: 2,
    endsAction: true,
    targetMode: "self_or_actor",
    maximumRange: 4,
    routes: [
      route(
        "ejector_tandem",
        "module.route.ejector_tandem.mechanism",
        "module.route.ejector_tandem.condition",
        "module.route.ejector_tandem.tradeoff",
      ),
      route(
        "ejector_long_burn",
        "module.route.ejector_long_burn.mechanism",
        "module.route.ejector_long_burn.condition",
        "module.route.ejector_long_burn.tradeoff",
      ),
    ],
  },
  aux_stabilizer: {
    id: "aux_stabilizer",
    nameKey: "module.aux_stabilizer.name",
    moduleClass: "auxiliary",
    energyCost: 1,
    cooldownRounds: 1,
    endsAction: false,
    targetMode: "self_or_actor",
    maximumRange: 2,
    routes: [
      route(
        "stabilizer_anchor",
        "module.route.stabilizer_anchor.mechanism",
        "module.route.stabilizer_anchor.condition",
        "module.route.stabilizer_anchor.tradeoff",
      ),
      route(
        "stabilizer_counterforce",
        "module.route.stabilizer_counterforce.mechanism",
        "module.route.stabilizer_counterforce.condition",
        "module.route.stabilizer_counterforce.tradeoff",
      ),
    ],
  },
  aux_route_scanner: {
    id: "aux_route_scanner",
    nameKey: "module.aux_route_scanner.name",
    moduleClass: "auxiliary",
    energyCost: 1,
    cooldownRounds: 1,
    endsAction: false,
    targetMode: "point",
    maximumRange: 8,
    routes: [
      route(
        "route_scanner_deep_intel",
        "module.route.route_scanner_deep_intel.mechanism",
        "module.route.route_scanner_deep_intel.condition",
        "module.route.route_scanner_deep_intel.tradeoff",
      ),
      route(
        "route_scanner_ballistic",
        "module.route.route_scanner_ballistic.mechanism",
        "module.route.route_scanner_ballistic.condition",
        "module.route.route_scanner_ballistic.tradeoff",
      ),
    ],
  },
  aux_energy_recycler: {
    id: "aux_energy_recycler",
    nameKey: "module.aux_energy_recycler.name",
    moduleClass: "auxiliary",
    energyCost: 1,
    cooldownRounds: 2,
    endsAction: false,
    targetMode: "self_or_actor",
    maximumRange: 2,
    routes: [
      route(
        "energy_recycler_team_loop",
        "module.route.energy_recycler_team_loop.mechanism",
        "module.route.energy_recycler_team_loop.condition",
        "module.route.energy_recycler_team_loop.tradeoff",
      ),
      route(
        "energy_recycler_overclock",
        "module.route.energy_recycler_overclock.mechanism",
        "module.route.energy_recycler_overclock.condition",
        "module.route.energy_recycler_overclock.tradeoff",
      ),
    ],
  },
  aux_grapple: {
    id: "aux_grapple",
    nameKey: "module.aux_grapple.name",
    moduleClass: "auxiliary",
    energyCost: 1,
    cooldownRounds: 1,
    endsAction: false,
    targetMode: "point",
    maximumRange: 5,
    routes: [
      route(
        "grapple_rescue_line",
        "module.route.grapple_rescue_line.mechanism",
        "module.route.grapple_rescue_line.condition",
        "module.route.grapple_rescue_line.tradeoff",
      ),
      route(
        "grapple_slingshot",
        "module.route.grapple_slingshot.mechanism",
        "module.route.grapple_slingshot.condition",
        "module.route.grapple_slingshot.tradeoff",
      ),
    ],
  },
  aux_terrain_foam: {
    id: "aux_terrain_foam",
    nameKey: "module.aux_terrain_foam.name",
    moduleClass: "auxiliary",
    energyCost: 2,
    cooldownRounds: 1,
    endsAction: false,
    targetMode: "point",
    maximumRange: 3,
    routes: [
      route(
        "terrain_foam_reinforced",
        "module.route.terrain_foam_reinforced.mechanism",
        "module.route.terrain_foam_reinforced.condition",
        "module.route.terrain_foam_reinforced.tradeoff",
      ),
      route(
        "terrain_foam_elastic",
        "module.route.terrain_foam_elastic.mechanism",
        "module.route.terrain_foam_elastic.condition",
        "module.route.terrain_foam_elastic.tradeoff",
      ),
    ],
  },
  aux_jammer: {
    id: "aux_jammer",
    nameKey: "module.aux_jammer.name",
    moduleClass: "auxiliary",
    energyCost: 2,
    cooldownRounds: 2,
    endsAction: false,
    targetMode: "point",
    maximumRange: 5,
    routes: [
      route(
        "jammer_decoy",
        "module.route.jammer_decoy.mechanism",
        "module.route.jammer_decoy.condition",
        "module.route.jammer_decoy.tradeoff",
      ),
      route(
        "jammer_silence",
        "module.route.jammer_silence.mechanism",
        "module.route.jammer_silence.condition",
        "module.route.jammer_silence.tradeoff",
      ),
    ],
  },
  aux_structure_scanner: {
    id: "aux_structure_scanner",
    nameKey: "module.aux_structure_scanner.name",
    moduleClass: "auxiliary",
    energyCost: 1,
    cooldownRounds: 1,
    endsAction: false,
    targetMode: "point",
    maximumRange: 8,
    routes: [
      route(
        "structure_scanner_predictive",
        "module.route.structure_scanner_predictive.mechanism",
        "module.route.structure_scanner_predictive.condition",
        "module.route.structure_scanner_predictive.tradeoff",
      ),
      route(
        "structure_scanner_salvage",
        "module.route.structure_scanner_salvage.mechanism",
        "module.route.structure_scanner_salvage.condition",
        "module.route.structure_scanner_salvage.tradeoff",
      ),
    ],
  },
});

const MODULE_ID_SET = new Set<string>(MODULE_IDS);
const ROUTE_ID_SET = new Set<string>(MODULE_UPGRADE_ROUTE_IDS);

export function isModuleId(value: string): value is ModuleId {
  return MODULE_ID_SET.has(value);
}

export function isModuleUpgradeRouteId(value: string): value is ModuleUpgradeRouteId {
  return ROUTE_ID_SET.has(value);
}

export function getModuleDefinition(id: ModuleId): ModuleDefinition {
  return MODULE_DEFINITIONS[id];
}

export function isRouteForModule(moduleId: ModuleId, routeId: ModuleUpgradeRouteId): boolean {
  return MODULE_DEFINITIONS[moduleId].routes.some((candidate) => candidate.id === routeId);
}

export interface ModuleLoadoutInput {
  readonly mainModuleId: ModuleId;
  readonly auxiliaryModuleIds: readonly ModuleId[];
  readonly selectedRoutes: readonly {
    readonly moduleId: ModuleId;
    readonly routeId: ModuleUpgradeRouteId;
  }[];
}

export function validateModuleLoadout(loadout: ModuleLoadoutInput): readonly string[] {
  const errors: string[] = [];
  if (getModuleDefinition(loadout.mainModuleId).moduleClass !== "main") {
    errors.push("main module slot must contain a main module");
  }
  if (loadout.auxiliaryModuleIds.length > 2) {
    errors.push("a robot cannot equip more than two auxiliary modules");
  }
  if (
    new Set(loadout.auxiliaryModuleIds).size !== loadout.auxiliaryModuleIds.length ||
    loadout.auxiliaryModuleIds.some(
      (moduleId) => getModuleDefinition(moduleId).moduleClass !== "auxiliary",
    )
  ) {
    errors.push("auxiliary slots must contain distinct auxiliary modules");
  }
  const equipped = new Set<ModuleId>([loadout.mainModuleId, ...loadout.auxiliaryModuleIds]);
  const selectedModules = new Set<ModuleId>();
  for (const selection of loadout.selectedRoutes) {
    if (!equipped.has(selection.moduleId)) {
      errors.push(`upgrade route references unequipped module ${selection.moduleId}`);
    }
    if (selectedModules.has(selection.moduleId)) {
      errors.push(`module ${selection.moduleId} cannot select both upgrade routes`);
    }
    selectedModules.add(selection.moduleId);
    if (!isRouteForModule(selection.moduleId, selection.routeId)) {
      errors.push(`route ${selection.routeId} does not belong to ${selection.moduleId}`);
    }
  }
  return errors;
}
