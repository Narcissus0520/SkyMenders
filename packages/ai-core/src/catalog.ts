import type { BattleActor, ModuleId } from "@skymenders/battle-core";

import type {
  AiDifficulty,
  AiDifficultyProfile,
  AiGoal,
  AiUtilityWeights,
  BossCounterSignal,
  BossDefinition,
  BossId,
  BossStageDefinition,
  EliteAffixDefinition,
  EliteAffixId,
  EliteTemplateDefinition,
  EliteTemplateId,
  EnemyDefinition,
  EnemyPrototypeId,
} from "./types.js";

const BASE_WEIGHTS: AiUtilityWeights = Object.freeze({
  taskBenefit: 110,
  expectedDamage: 90,
  terrainBenefit: 75,
  selfSafety: 80,
  controlBenefit: 85,
  energyCost: 65,
  friendlyFireRisk: 130,
  fallRisk: 125,
  exposureRisk: 75,
});

function weights(overrides: Partial<AiUtilityWeights>): AiUtilityWeights {
  return Object.freeze({ ...BASE_WEIGHTS, ...overrides });
}

export const AI_DIFFICULTY_PROFILES: Readonly<Record<AiDifficulty, AiDifficultyProfile>> =
  Object.freeze({
    normal: {
      id: "normal",
      maximumMoveCandidates: 5,
      maximumTargetCandidatesPerModule: 10,
      maximumCandidates: 28,
      angleErrorMilliDegrees: 24_000,
      powerErrorPermille: 120,
      objectiveAwarenessPermille: 650,
      hazardAwarenessPermille: 550,
    },
    hard: {
      id: "hard",
      maximumMoveCandidates: 10,
      maximumTargetCandidatesPerModule: 24,
      maximumCandidates: 64,
      angleErrorMilliDegrees: 10_000,
      powerErrorPermille: 50,
      objectiveAwarenessPermille: 850,
      hazardAwarenessPermille: 800,
    },
    expert: {
      id: "expert",
      maximumMoveCandidates: 18,
      maximumTargetCandidatesPerModule: 48,
      maximumCandidates: 128,
      angleErrorMilliDegrees: 3_000,
      powerErrorPermille: 15,
      objectiveAwarenessPermille: 1_000,
      hazardAwarenessPermille: 1_000,
    },
  });

export const ENEMY_DEFINITIONS: Readonly<Record<EnemyPrototypeId, EnemyDefinition>> = Object.freeze(
  {
    enemy_scout: {
      id: "enemy_scout",
      nameKey: "enemy.enemy_scout.name",
      roleKey: "enemy.enemy_scout.role",
      baseHp: 85,
      mainModuleId: "main_energy_rail",
      auxiliaryModuleIds: ["aux_route_scanner", "aux_jammer"],
      selectedRoutes: [
        { moduleId: "main_energy_rail", routeId: "energy_rail_switchback" },
        { moduleId: "aux_route_scanner", routeId: "route_scanner_ballistic" },
      ],
      flags: ["field_controller", "long_range"],
      preferredGoals: ["control_field", "pressure_target", "reposition"],
      utilityWeights: weights({ taskBenefit: 135, controlBenefit: 125, exposureRisk: 95 }),
    },
    enemy_guard: {
      id: "enemy_guard",
      nameKey: "enemy.enemy_guard.name",
      roleKey: "enemy.enemy_guard.role",
      baseHp: 125,
      mainModuleId: "main_bubble_capsule",
      auxiliaryModuleIds: ["aux_reflector", "aux_stabilizer"],
      selectedRoutes: [
        { moduleId: "main_bubble_capsule", routeId: "bubble_capsule_rescue" },
        { moduleId: "aux_reflector", routeId: "reflector_wide_guard" },
      ],
      flags: ["protector"],
      preferredGoals: ["recover", "control_field", "pressure_target"],
      utilityWeights: weights({ selfSafety: 145, controlBenefit: 110, expectedDamage: 55 }),
    },
    enemy_artillery: {
      id: "enemy_artillery",
      nameKey: "enemy.enemy_artillery.name",
      roleKey: "enemy.enemy_artillery.role",
      baseHp: 90,
      mainModuleId: "main_energy_rail",
      auxiliaryModuleIds: ["aux_reflector", "aux_structure_scanner"],
      selectedRoutes: [
        { moduleId: "main_energy_rail", routeId: "energy_rail_accelerator" },
        { moduleId: "aux_structure_scanner", routeId: "structure_scanner_predictive" },
      ],
      flags: ["long_range"],
      preferredGoals: ["pressure_target", "disrupt_support", "reposition"],
      utilityWeights: weights({ expectedDamage: 150, terrainBenefit: 100, selfSafety: 60 }),
    },
    enemy_driller: {
      id: "enemy_driller",
      nameKey: "enemy.enemy_driller.name",
      roleKey: "enemy.enemy_driller.role",
      baseHp: 110,
      mainModuleId: "main_drill_bee",
      auxiliaryModuleIds: ["aux_structure_scanner", "aux_stabilizer"],
      selectedRoutes: [
        { moduleId: "main_drill_bee", routeId: "drill_bee_precision" },
        { moduleId: "aux_structure_scanner", routeId: "structure_scanner_predictive" },
      ],
      flags: ["support_disruptor"],
      preferredGoals: ["disrupt_support", "pressure_target", "reposition"],
      utilityWeights: weights({ terrainBenefit: 165, expectedDamage: 115, fallRisk: 150 }),
    },
    enemy_magnet: {
      id: "enemy_magnet",
      nameKey: "enemy.enemy_magnet.name",
      roleKey: "enemy.enemy_magnet.role",
      baseHp: 105,
      mainModuleId: "main_magnetic_anchor",
      auxiliaryModuleIds: ["aux_jammer", "aux_stabilizer"],
      selectedRoutes: [
        { moduleId: "main_magnetic_anchor", routeId: "magnetic_anchor_precision" },
        { moduleId: "aux_jammer", routeId: "jammer_decoy" },
      ],
      flags: ["field_controller"],
      preferredGoals: ["control_field", "secure_objective", "pressure_target"],
      utilityWeights: weights({ taskBenefit: 130, controlBenefit: 165, expectedDamage: 105 }),
    },
    enemy_repairer: {
      id: "enemy_repairer",
      nameKey: "enemy.enemy_repairer.name",
      roleKey: "enemy.enemy_repairer.role",
      baseHp: 95,
      mainModuleId: "main_support_frame",
      auxiliaryModuleIds: ["aux_repair_spray", "aux_terrain_foam"],
      selectedRoutes: [
        { moduleId: "main_support_frame", routeId: "support_frame_mobile" },
        { moduleId: "aux_repair_spray", routeId: "repair_spray_unit_specialist" },
      ],
      flags: ["repair_capable", "protector"],
      preferredGoals: ["recover", "secure_objective", "control_field"],
      utilityWeights: weights({ selfSafety: 160, terrainBenefit: 140, expectedDamage: 35 }),
    },
    enemy_wind: {
      id: "enemy_wind",
      nameKey: "enemy.enemy_wind.name",
      roleKey: "enemy.enemy_wind.role",
      baseHp: 100,
      mainModuleId: "main_wind_generator",
      auxiliaryModuleIds: ["aux_reflector", "aux_jammer"],
      selectedRoutes: [
        { moduleId: "main_wind_generator", routeId: "wind_generator_sustained" },
        { moduleId: "aux_reflector", routeId: "reflector_prismatic" },
      ],
      flags: ["field_controller", "long_range"],
      preferredGoals: ["control_field", "pressure_target", "disrupt_support"],
      utilityWeights: weights({ controlBenefit: 175, expectedDamage: 100, taskBenefit: 90 }),
    },
    enemy_carrier: {
      id: "enemy_carrier",
      nameKey: "enemy.enemy_carrier.name",
      roleKey: "enemy.enemy_carrier.role",
      baseHp: 115,
      mainModuleId: "main_magnetic_anchor",
      auxiliaryModuleIds: ["aux_grapple", "aux_ejector"],
      selectedRoutes: [
        { moduleId: "main_magnetic_anchor", routeId: "magnetic_anchor_heavy_pull" },
        { moduleId: "aux_grapple", routeId: "grapple_rescue_line" },
      ],
      flags: ["objective_carrier"],
      preferredGoals: ["secure_objective", "reposition", "control_field"],
      utilityWeights: weights({ taskBenefit: 185, selfSafety: 110, expectedDamage: 60 }),
    },
  },
);

export const ELITE_AFFIX_DEFINITIONS: Readonly<Record<EliteAffixId, EliteAffixDefinition>> =
  Object.freeze({
    stable_core: {
      id: "stable_core",
      nameKey: "elite.stable_core.name",
      mechanicKey: "elite.stable_core.mechanic",
      preferredModules: ["aux_stabilizer", "main_support_frame"],
      weightAdjustments: {
        fallRisk: 45,
        selfSafety: 15,
        exposureRisk: -20,
        controlBenefit: 10,
      },
    },
    reflective_shell: {
      id: "reflective_shell",
      nameKey: "elite.reflective_shell.name",
      mechanicKey: "elite.reflective_shell.mechanic",
      preferredModules: ["aux_reflector", "main_energy_rail"],
      weightAdjustments: { controlBenefit: 35, selfSafety: 25 },
    },
    overdrive_circuit: {
      id: "overdrive_circuit",
      nameKey: "elite.overdrive_circuit.name",
      mechanicKey: "elite.overdrive_circuit.mechanic",
      preferredModules: ["aux_energy_recycler", "main_energy_rail"],
      weightAdjustments: { expectedDamage: 35, energyCost: -20, exposureRisk: 20 },
    },
    coordinated_protocol: {
      id: "coordinated_protocol",
      nameKey: "elite.coordinated_protocol.name",
      mechanicKey: "elite.coordinated_protocol.mechanic",
      preferredModules: ["aux_jammer", "main_magnetic_anchor"],
      weightAdjustments: { taskBenefit: 30, controlBenefit: 30, friendlyFireRisk: 25 },
    },
    emergency_patch: {
      id: "emergency_patch",
      nameKey: "elite.emergency_patch.name",
      mechanicKey: "elite.emergency_patch.mechanic",
      preferredModules: ["aux_repair_spray", "aux_terrain_foam"],
      weightAdjustments: { selfSafety: 55, terrainBenefit: 20 },
    },
    hover_chassis: {
      id: "hover_chassis",
      nameKey: "elite.hover_chassis.name",
      mechanicKey: "elite.hover_chassis.mechanic",
      preferredModules: ["aux_grapple", "aux_ejector"],
      weightAdjustments: { fallRisk: 55, exposureRisk: 25, selfSafety: 20 },
    },
  });

export const ELITE_TEMPLATE_DEFINITIONS: Readonly<
  Record<EliteTemplateId, EliteTemplateDefinition>
> = Object.freeze({
  elite_stable_scout: {
    id: "elite_stable_scout",
    prototypeId: "enemy_scout",
    affixIds: ["stable_core"],
  },
  elite_reflect_guard: {
    id: "elite_reflect_guard",
    prototypeId: "enemy_guard",
    affixIds: ["reflective_shell"],
  },
  elite_overdrive_artillery: {
    id: "elite_overdrive_artillery",
    prototypeId: "enemy_artillery",
    affixIds: ["overdrive_circuit"],
  },
  elite_coord_driller: {
    id: "elite_coord_driller",
    prototypeId: "enemy_driller",
    affixIds: ["coordinated_protocol"],
  },
  elite_emergency_repairer: {
    id: "elite_emergency_repairer",
    prototypeId: "enemy_repairer",
    affixIds: ["emergency_patch"],
  },
  elite_hover_carrier: {
    id: "elite_hover_carrier",
    prototypeId: "enemy_carrier",
    affixIds: ["hover_chassis"],
  },
  elite_tempest_pair: {
    id: "elite_tempest_pair",
    prototypeId: "enemy_wind",
    affixIds: ["overdrive_circuit", "coordinated_protocol"],
  },
  elite_bastion_pair: {
    id: "elite_bastion_pair",
    prototypeId: "enemy_guard",
    affixIds: ["stable_core", "reflective_shell"],
  },
});

const twoRoute = (
  first: readonly BossCounterSignal[],
  second: readonly BossCounterSignal[],
): readonly [readonly BossCounterSignal[], readonly BossCounterSignal[]] => [first, second];

export const BOSS_DEFINITIONS: Readonly<Record<BossId, BossDefinition>> = Object.freeze({
  boss_rift_drill: {
    id: "boss_rift_drill",
    nameKey: "boss.boss_rift_drill.name",
    baseHp: 260,
    mainModuleId: "main_drill_bee",
    auxiliaryModuleIds: ["aux_structure_scanner", "aux_stabilizer"],
    selectedRoutes: [
      { moduleId: "main_drill_bee", routeId: "drill_bee_deep_bore" },
      { moduleId: "aux_structure_scanner", routeId: "structure_scanner_predictive" },
    ],
    utilityWeights: weights({ terrainBenefit: 190, expectedDamage: 135, fallRisk: 155 }),
    stages: [
      bossStage(
        "external_drills",
        "disrupt_support",
        ["main_drill_bee"],
        ["terrain_breached", "magnetic_redirected"],
      ),
      bossStage(
        "failing_span",
        "control_field",
        ["aux_structure_scanner"],
        ["support_restored", "gravity_redirected"],
      ),
      bossStage(
        "exposed_core",
        "pressure_target",
        ["main_drill_bee"],
        ["energy_routed", "control_disrupted"],
      ),
    ],
    solutionRoutes: twoRoute(
      repeatRoute(["terrain_breached", "support_restored", "energy_routed"]),
      repeatRoute(["magnetic_redirected", "gravity_redirected", "control_disrupted"]),
    ),
  },
  boss_polar_magnetic_tower: {
    id: "boss_polar_magnetic_tower",
    nameKey: "boss.boss_polar_magnetic_tower.name",
    baseHp: 250,
    mainModuleId: "main_magnetic_anchor",
    auxiliaryModuleIds: ["aux_jammer", "aux_stabilizer"],
    selectedRoutes: [
      { moduleId: "main_magnetic_anchor", routeId: "magnetic_anchor_heavy_pull" },
      { moduleId: "aux_jammer", routeId: "jammer_silence" },
    ],
    utilityWeights: weights({ controlBenefit: 195, taskBenefit: 150, expectedDamage: 95 }),
    stages: [
      bossStage(
        "repulsion_grid",
        "control_field",
        ["main_magnetic_anchor"],
        ["magnetic_redirected", "gravity_redirected"],
      ),
      bossStage(
        "core_transit",
        "secure_objective",
        ["aux_jammer"],
        ["support_restored", "rescue_secured"],
      ),
      bossStage(
        "tower_core",
        "pressure_target",
        ["main_magnetic_anchor"],
        ["energy_routed", "control_disrupted"],
      ),
    ],
    solutionRoutes: twoRoute(
      repeatRoute(["magnetic_redirected", "support_restored", "energy_routed"]),
      repeatRoute(["gravity_redirected", "rescue_secured", "control_disrupted"]),
    ),
  },
  boss_inverted_controller: {
    id: "boss_inverted_controller",
    nameKey: "boss.boss_inverted_controller.name",
    baseHp: 240,
    mainModuleId: "main_gravity_pin",
    auxiliaryModuleIds: ["aux_ejector", "aux_structure_scanner"],
    selectedRoutes: [
      { moduleId: "main_gravity_pin", routeId: "gravity_pin_inversion" },
      { moduleId: "aux_ejector", routeId: "ejector_tandem" },
    ],
    utilityWeights: weights({ controlBenefit: 185, fallRisk: 185, selfSafety: 105 }),
    stages: [
      bossStage(
        "gravity_flip",
        "control_field",
        ["main_gravity_pin"],
        ["gravity_redirected", "support_restored"],
      ),
      bossStage(
        "stabilizer_cycle",
        "secure_objective",
        ["aux_ejector"],
        ["core_repaired", "energy_routed"],
      ),
      bossStage(
        "inverted_weakpoint",
        "pressure_target",
        ["main_gravity_pin"],
        ["control_disrupted", "terrain_breached"],
      ),
    ],
    solutionRoutes: twoRoute(
      repeatRoute(["gravity_redirected", "core_repaired", "control_disrupted"]),
      repeatRoute(["support_restored", "energy_routed", "terrain_breached"]),
    ),
  },
  boss_unbound_island_mainframe: {
    id: "boss_unbound_island_mainframe",
    nameKey: "boss.boss_unbound_island_mainframe.name",
    baseHp: 300,
    mainModuleId: "main_support_frame",
    auxiliaryModuleIds: ["aux_repair_spray", "aux_jammer"],
    selectedRoutes: [
      { moduleId: "main_support_frame", routeId: "support_frame_fortified" },
      { moduleId: "aux_jammer", routeId: "jammer_decoy" },
    ],
    utilityWeights: weights({ taskBenefit: 180, terrainBenefit: 155, controlBenefit: 150 }),
    stages: [
      bossStage(
        "spawn_loop",
        "control_field",
        ["aux_jammer"],
        ["control_disrupted", "magnetic_redirected"],
      ),
      bossStage(
        "energy_crisis",
        "secure_objective",
        ["aux_repair_spray"],
        ["energy_routed", "core_repaired"],
      ),
      bossStage(
        "mainframe_core",
        "pressure_target",
        ["main_support_frame"],
        ["terrain_breached", "support_restored"],
      ),
    ],
    solutionRoutes: twoRoute(
      repeatRoute(["control_disrupted", "energy_routed", "terrain_breached"]),
      repeatRoute(["magnetic_redirected", "core_repaired", "support_restored"]),
    ),
  },
});

function bossStage(
  id: string,
  preferredGoal: AiGoal,
  preferredModules: readonly ModuleId[],
  counters: readonly [BossCounterSignal, BossCounterSignal],
): BossStageDefinition {
  return {
    id,
    nameKey: `boss.stage.${id}.name`,
    mechanicKey: `boss.stage.${id}.mechanic`,
    cueKey: `boss.stage.${id}.cue`,
    preferredGoal,
    preferredModules,
    counters,
    requiredProgress: 2,
  };
}

function repeatRoute(signals: readonly BossCounterSignal[]): readonly BossCounterSignal[] {
  return signals.flatMap((signal) => [signal, signal]);
}

export function getEnemyDefinition(id: EnemyPrototypeId): EnemyDefinition {
  return ENEMY_DEFINITIONS[id];
}

export function getEliteTemplate(id: EliteTemplateId): EliteTemplateDefinition {
  return ELITE_TEMPLATE_DEFINITIONS[id];
}

export function getBossDefinition(id: BossId): BossDefinition {
  return BOSS_DEFINITIONS[id];
}

export function eliteAffixes(id: EliteTemplateId | null): readonly EliteAffixDefinition[] {
  if (id === null) return [];
  return getEliteTemplate(id).affixIds.map((affixId) => ELITE_AFFIX_DEFINITIONS[affixId]);
}

export function mergedUtilityWeights(
  base: AiUtilityWeights,
  affixIds: readonly EliteAffixId[],
): AiUtilityWeights {
  const result = { ...base };
  for (const affixId of affixIds) {
    const adjustments = ELITE_AFFIX_DEFINITIONS[affixId].weightAdjustments;
    for (const [key, value] of Object.entries(adjustments) as [keyof AiUtilityWeights, number][]) {
      result[key] += value;
    }
  }
  return result;
}

export function createEnemyActor(
  id: string,
  prototypeId: EnemyPrototypeId,
  x: number,
  y: number,
): BattleActor {
  const definition = getEnemyDefinition(prototypeId);
  return actorFromDefinition(
    id,
    x,
    y,
    definition.baseHp,
    definition.mainModuleId,
    definition.auxiliaryModuleIds,
    definition.selectedRoutes,
  );
}

export function createBossActor(id: string, bossId: BossId, x: number, y: number): BattleActor {
  const definition = getBossDefinition(bossId);
  return actorFromDefinition(
    id,
    x,
    y,
    definition.baseHp,
    definition.mainModuleId,
    definition.auxiliaryModuleIds,
    definition.selectedRoutes,
  );
}

function actorFromDefinition(
  id: string,
  x: number,
  y: number,
  hp: number,
  mainModuleId: BattleActor["mainModuleId"],
  auxiliaryModuleIds: BattleActor["auxiliaryModuleIds"],
  selectedRoutes: BattleActor["selectedRoutes"],
): BattleActor {
  return {
    id,
    team: "enemy",
    x,
    y,
    hp,
    maxHp: hp,
    structuralDamage: 0,
    faults: [],
    disabled: false,
    recoveryBeaconId: null,
    carriedObjectId: null,
    movementUsed: false,
    mainModuleUsed: false,
    actionEnded: false,
    auxiliaryUses: 0,
    mainModuleId,
    auxiliaryModuleIds: [...auxiliaryModuleIds],
    selectedRoutes: [...selectedRoutes],
    cooldowns: [],
  };
}
