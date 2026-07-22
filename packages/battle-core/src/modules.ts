import type { UseModuleCommand } from "@skymenders/protocol";
import {
  addTerrainSupportRoot,
  analyzeTerrainSupport,
  applyTerrainDamage,
  applyTerrainRepair,
  getTerrainCell,
  isTerrainPointInBounds,
  terrainIndex,
} from "@skymenders/terrain-core";

import { applyActorDurabilityDamage, repairBattleActor } from "./durability.js";
import { getModuleDefinition, isModuleId } from "./module-registry.js";
import type { ModuleId } from "./module-registry.js";
import { applyObjectiveSignal } from "./objectives.js";
import {
  actorCooldown,
  actorHasModule,
  actorTeamEnergy,
  effectiveModuleCooldown,
  effectiveModuleEnergyCost,
  findBattleActor,
  manhattanDistance,
  replaceBattleActor,
  replaceActorTeamEnergy,
  selectedRoute,
  terrainIntegrityPermille,
} from "./state.js";
import type {
  BattleActor,
  BattleFieldEffect,
  BattleRuleConfig,
  BattleRuleEffect,
  BattleState,
  BattleTransition,
} from "./types.js";

export function resolveModuleCommand(
  state: BattleState,
  command: UseModuleCommand,
  config: BattleRuleConfig,
): BattleTransition {
  if (!isModuleId(command.moduleId)) throw new Error(`unknown module: ${command.moduleId}`);
  const moduleId = command.moduleId;
  const actor = findBattleActor(state, command.actorId);
  assertModuleUsable(state, actor, moduleId, command, config);
  const energyCost = effectiveModuleEnergyCost(actor, moduleId);
  const cooldown = effectiveModuleCooldown(actor, moduleId);
  const definition = getModuleDefinition(moduleId);
  const existingRecycler = state.fieldEffects.find(
    (effect) =>
      effect.kind === "energy_recycler" &&
      effect.targetActorId === actor.id &&
      !effect.consumed &&
      moduleId !== "aux_energy_recycler",
  );
  const preparedActor: BattleActor = {
    ...actor,
    mainModuleUsed: definition.moduleClass === "main" || actor.mainModuleUsed,
    auxiliaryUses:
      definition.moduleClass === "auxiliary" ? actor.auxiliaryUses + 1 : actor.auxiliaryUses,
    actionEnded: definition.endsAction || actor.actionEnded,
    cooldowns: setCooldown(actor.cooldowns, moduleId, cooldown),
  };
  const teamEnergy = actorTeamEnergy(state, actor.team);
  let prepared = replaceActorTeamEnergy(replaceBattleActor(state, preparedActor), actor.team, {
    ...teamEnergy,
    current: teamEnergy.current - energyCost,
  });
  const effects: BattleRuleEffect[] = [
    ruleEffect("energy_changed", actor.id, null, null, null, -energyCost, 0, {
      moduleId,
      reason: "module_cost",
      team: actor.team,
    }),
  ];

  const resolved = resolveModuleMechanic(prepared, command, moduleId);
  prepared = resolved.state;
  effects.push(...resolved.effects);

  if (existingRecycler !== undefined) {
    const preparedTeamEnergy = actorTeamEnergy(prepared, actor.team);
    const refund = Math.min(
      existingRecycler.magnitude,
      preparedTeamEnergy.maximum - preparedTeamEnergy.current,
    );
    prepared = replaceActorTeamEnergy(
      {
        ...prepared,
        fieldEffects: prepared.fieldEffects.map((effect) =>
          effect.id === existingRecycler.id ? { ...effect, consumed: true } : effect,
        ),
      },
      actor.team,
      { ...preparedTeamEnergy, current: preparedTeamEnergy.current + refund },
    );
    effects.push(
      ruleEffect(
        "energy_changed",
        existingRecycler.sourceActorId,
        actor.id,
        actor.x,
        actor.y,
        refund,
        0,
        {
          moduleId,
          reason: "energy_recycler",
          team: actor.team,
        },
      ),
    );
    if (existingRecycler.magnitude >= 3) {
      const overloaded = applyActorDurabilityDamage(prepared, actor.id, {
        hpDamage: 0,
        structuralDamage: 10,
        source: "overload",
        sourceId: existingRecycler.id,
      });
      prepared = overloaded.state;
      effects.push(...overloaded.effects);
    }
  }
  const objectiveSignals = new Set<string>();
  for (const objective of prepared.objectives) {
    if (
      objective.status !== "active" ||
      objective.requiredModuleId !== moduleId ||
      (objective.targetId !== null && objective.targetId !== (command.targetId ?? null))
    ) {
      continue;
    }
    const key = `${objective.trigger}:${objective.targetId ?? "*"}`;
    if (objectiveSignals.has(key)) continue;
    objectiveSignals.add(key);
    const progressed = applyObjectiveSignal(prepared, {
      trigger: objective.trigger,
      sourceId: actor.id,
      targetId: command.targetId ?? null,
      amount: 1,
    });
    prepared = progressed.state;
    effects.push(...progressed.effects);
  }
  return { state: prepared, effects };
}

function resolveModuleMechanic(
  state: BattleState,
  command: UseModuleCommand,
  moduleId: ModuleId,
): BattleTransition {
  switch (moduleId) {
    case "main_fold_bridge":
      return resolveFoldBridge(state, command);
    case "main_drill_bee":
      return resolveDrillBee(state, command);
    case "main_magnetic_anchor":
      return resolveMagneticAnchor(state, command);
    case "main_gravity_pin":
      return resolveGravityPin(state, command);
    case "main_bubble_capsule":
      return resolveBubbleCapsule(state, command);
    case "main_wind_generator":
      return resolveWindGenerator(state, command);
    case "main_support_frame":
      return resolveSupportFrame(state, command);
    case "main_energy_rail":
      return resolveEnergyRail(state, command);
    case "aux_repair_spray":
      return resolveRepairSpray(state, command);
    case "aux_reflector":
      return resolveReflector(state, command);
    case "aux_ejector":
      return resolveEjector(state, command);
    case "aux_stabilizer":
      return resolveStabilizer(state, command);
    case "aux_route_scanner":
      return resolveRouteScanner(state, command);
    case "aux_energy_recycler":
      return resolveEnergyRecycler(state, command);
    case "aux_grapple":
      return resolveGrapple(state, command);
    case "aux_terrain_foam":
      return resolveTerrainFoam(state, command);
    case "aux_jammer":
      return resolveJammer(state, command);
    case "aux_structure_scanner":
      return resolveStructureScanner(state, command);
  }
}

function resolveFoldBridge(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = targetPoint(command);
  const direction = Math.sign(target.x - actor.x);
  if (direction === 0 || target.y < 0 || target.y >= state.terrain.height) {
    throw new Error("fold bridge requires a horizontal gap target");
  }
  const route = selectedRoute(actor, "main_fold_bridge");
  const maximumSpan =
    route === "fold_bridge_conductive" ? 5 : route === "fold_bridge_reinforced" ? 3 : 4;
  const cells = horizontalCells(actor.x + direction, target.x, target.y, direction);
  if (cells.length === 0 || cells.length > maximumSpan)
    throw new Error("fold bridge span is illegal");
  const startingSupport = getTerrainCell(state.terrain, actor.x, target.y);
  const endingX = target.x + direction;
  if (!isTerrainPointInBounds(state.terrain, endingX, target.y)) {
    throw new Error("fold bridge ending support lies outside terrain");
  }
  const endingSupport = getTerrainCell(state.terrain, endingX, target.y);
  if (startingSupport === null || endingSupport === null) {
    throw new Error("fold bridge requires occupied support at both ends");
  }
  let terrain = state.terrain;
  for (const cell of cells) {
    if (getTerrainCell(terrain, cell.x, cell.y) !== null)
      throw new Error("bridge cell is occupied");
    terrain = applyTerrainRepair(terrain, {
      ...cell,
      materialId: "terrain_alloy_frame",
      amount: route === "fold_bridge_reinforced" ? 1_000 : 700,
      availableEnergy: 1_000,
    }).state;
  }
  const effectId = effectIdFor(command, "bridge");
  const duration = route === "fold_bridge_reinforced" ? 4 : 3;
  let next: BattleState = {
    ...state,
    terrain,
    temporaryTerrain: [...state.temporaryTerrain, { effectId, cells, remainingRounds: duration }],
  };
  const effects = [
    ruleEffect("terrain_repaired", actor.id, effectId, target.x, target.y, cells.length, duration, {
      moduleId: "main_fold_bridge",
      route: route ?? "base",
    }),
  ];
  if (route === "fold_bridge_conductive") {
    const field = fieldEffect(command, "conductive_bridge", null, target, 1, 150, duration);
    next = { ...next, fieldEffects: [...next.fieldEffects, field] };
    effects.push(fieldCreatedEffect(field));
  }
  return { state: next, effects };
}

function resolveDrillBee(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = targetPoint(command);
  const route = selectedRoute(actor, "main_drill_bee");
  const maximumCells = route === "drill_bee_deep_bore" ? 7 : 5;
  const line = traceLine(actor, target).slice(1, maximumCells + 1);
  if (line.length === 0) throw new Error("drill bee requires a direction");
  let terrain = state.terrain;
  let affected = 0;
  for (const point of line) {
    if (!isTerrainPointInBounds(terrain, point.x, point.y)) break;
    const result = applyTerrainDamage(terrain, {
      ...point,
      radius: route === "drill_bee_precision" ? 0 : 1,
      energy:
        route === "drill_bee_precision" ? 1_600 : route === "drill_bee_deep_bore" ? 1_300 : 1_100,
    });
    terrain = result.state;
    affected += result.affectedCells.length;
  }
  return {
    state: {
      ...state,
      terrain,
      statistics: {
        ...state.statistics,
        directAttacksUsed: state.statistics.directAttacksUsed + 1,
        terrainIntegrityPermille: terrainIntegrityPermille(
          terrain,
          state.statistics.terrainInitialIntegrity,
        ),
      },
    },
    effects: [
      ruleEffect("terrain_damaged", actor.id, null, target.x, target.y, affected, 0, {
        moduleId: "main_drill_bee",
        route: route ?? "base",
      }),
    ],
  };
}

function resolveMagneticAnchor(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = targetPoint(command);
  const route = selectedRoute(actor, "main_magnetic_anchor");
  const distance =
    route === "magnetic_anchor_heavy_pull" ? 3 : route === "magnetic_anchor_precision" ? 1 : 2;
  const object = state.worldObjects.find(
    (candidate) => candidate.active && candidate.x === target.x && candidate.y === target.y,
  );
  const targetActor = state.actors.find(
    (candidate) => !candidate.disabled && candidate.x === target.x && candidate.y === target.y,
  );
  if (object === undefined && targetActor === undefined)
    throw new Error("magnetic anchor target not found");
  if (
    object !== undefined &&
    object.kind !== "metal_object" &&
    !(route === "magnetic_anchor_precision" && object.kind === "task_object")
  ) {
    throw new Error("magnetic anchor target is not magnetically controllable");
  }
  const moving = object ?? targetActor;
  if (moving === undefined) throw new Error("magnetic target resolution failed");
  const destination = stepToward(moving, actor, distance);
  assertOpenPosition(state, destination.x, destination.y, moving.id);
  let next = state;
  if (object !== undefined) {
    next = {
      ...next,
      worldObjects: next.worldObjects.map((candidate) =>
        candidate.id === object.id ? { ...candidate, ...destination } : candidate,
      ),
    };
  } else if (targetActor !== undefined) {
    next = replaceBattleActor(next, { ...targetActor, ...destination });
  }
  const effects: BattleRuleEffect[] = [
    ruleEffect(
      "world_object_moved",
      actor.id,
      moving.id,
      destination.x,
      destination.y,
      distance,
      0,
      {
        moduleId: "main_magnetic_anchor",
        route: route ?? "base",
      },
    ),
  ];
  const collision = next.actors.find(
    (candidate) =>
      candidate.id !== moving.id &&
      !candidate.disabled &&
      manhattanDistance(candidate, destination) === 1,
  );
  if (collision !== undefined && route !== "magnetic_anchor_precision") {
    const damaged = applyActorDurabilityDamage(next, collision.id, {
      hpDamage: route === "magnetic_anchor_heavy_pull" ? 12 : 6,
      structuralDamage: route === "magnetic_anchor_heavy_pull" ? 20 : 10,
      source: "magnetic",
      sourceId: actor.id,
    });
    next = {
      ...damaged.state,
      statistics: {
        ...damaged.state.statistics,
        magneticCollisions: damaged.state.statistics.magneticCollisions + 1,
      },
    };
    effects.push(...damaged.effects);
  }
  return { state: next, effects };
}

function resolveGravityPin(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = targetPoint(command);
  const route = selectedRoute(actor, "main_gravity_pin");
  const field = fieldEffect(
    command,
    "gravity_field",
    null,
    target,
    route === "gravity_pin_rescue" ? 4 : 3,
    route === "gravity_pin_inversion" ? 1_000 : route === "gravity_pin_rescue" ? 400 : 700,
    route === "gravity_pin_rescue" ? 3 : 2,
  );
  return appendField(state, field);
}

function resolveBubbleCapsule(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = actorAtTargetOrSelf(state, actor, command);
  const route = selectedRoute(actor, "main_bubble_capsule");
  if (route !== "bubble_capsule_rescue" && target.team !== actor.team) {
    throw new Error("bubble capsule can only protect allies");
  }
  const field = fieldEffect(
    command,
    "bubble",
    target.id,
    target,
    route === "bubble_capsule_rescue" ? 2 : 1,
    route === "bubble_capsule_rebound" ? 900 : route === "bubble_capsule_rescue" ? 400 : 600,
    route === "bubble_capsule_rescue" ? 3 : 2,
  );
  return appendField(state, field);
}

function resolveWindGenerator(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = targetPoint(command);
  const route = selectedRoute(actor, "main_wind_generator");
  const field = fieldEffect(
    command,
    "wind_field",
    null,
    target,
    4,
    route === "wind_generator_sustained" ? 450 : 700,
    route === "wind_generator_sustained" ? 4 : 2,
  );
  const appended = appendField(state, field);
  if (route !== "wind_generator_turbine") return appended;
  const teamEnergy = actorTeamEnergy(appended.state, actor.team);
  const refund = Math.min(1, teamEnergy.maximum - teamEnergy.current);
  return {
    state: replaceActorTeamEnergy(appended.state, actor.team, {
      ...teamEnergy,
      current: teamEnergy.current + refund,
    }),
    effects: [
      ...appended.effects,
      ruleEffect("energy_changed", actor.id, null, target.x, target.y, refund, 0, {
        reason: "wind_turbine",
        team: actor.team,
      }),
    ],
  };
}

function resolveSupportFrame(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = targetPoint(command);
  if (getTerrainCell(state.terrain, target.x, target.y) === null) {
    throw new Error("support frame must attach to occupied terrain");
  }
  const route = selectedRoute(actor, "main_support_frame");
  const rootId = `support:${command.commandId}`;
  const duration =
    route === "support_frame_mobile" ? 1 : route === "support_frame_fortified" ? 4 : 3;
  const capacity =
    route === "support_frame_fortified" ? 8_000 : route === "support_frame_mobile" ? 3_000 : 5_000;
  const terrain = addTerrainSupportRoot(state.terrain, {
    id: rootId,
    kind: "support_structure",
    ...target,
    capacity,
  });
  let next: BattleState = {
    ...state,
    terrain,
    temporarySupports: [
      ...state.temporarySupports,
      { effectId: effectIdFor(command, "support"), rootId, remainingRounds: duration },
    ],
  };
  const effects = [
    ruleEffect("support_created", actor.id, rootId, target.x, target.y, capacity, duration, {
      route: route ?? "base",
    }),
  ];
  if (route === "support_frame_mobile") {
    const teamEnergy = actorTeamEnergy(next, actor.team);
    const refund = Math.min(1, teamEnergy.maximum - teamEnergy.current);
    next = replaceActorTeamEnergy(next, actor.team, {
      ...teamEnergy,
      current: teamEnergy.current + refund,
    });
    effects.push(
      ruleEffect("energy_changed", actor.id, rootId, target.x, target.y, refund, 0, {
        reason: "mobile_support",
        team: actor.team,
      }),
    );
  }
  return { state: next, effects };
}

function resolveEnergyRail(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = targetPoint(command);
  const route = selectedRoute(actor, "main_energy_rail");
  const field = fieldEffect(
    command,
    "energy_rail",
    null,
    target,
    route === "energy_rail_switchback" ? 3 : 2,
    route === "energy_rail_accelerator" ? 1_500 : route === "energy_rail_switchback" ? 850 : 1_200,
    route === "energy_rail_switchback" ? 2 : 3,
  );
  return appendField(state, field);
}

function resolveRepairSpray(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = targetPoint(command);
  const route = selectedRoute(actor, "aux_repair_spray");
  const targetActor = state.actors.find(
    (candidate) => !candidate.disabled && candidate.x === target.x && candidate.y === target.y,
  );
  if (targetActor !== undefined) {
    const amount =
      route === "repair_spray_unit_specialist"
        ? 30
        : route === "repair_spray_terrain_specialist"
          ? 8
          : 18;
    return repairBattleActor(state, targetActor.id, amount, actor.id);
  }
  const materialId =
    getTerrainCell(state.terrain, target.x, target.y)?.materialId ?? "terrain_cloud_soil";
  const amount =
    route === "repair_spray_terrain_specialist"
      ? 600
      : route === "repair_spray_unit_specialist"
        ? 150
        : 350;
  const result = applyTerrainRepair(state.terrain, {
    ...target,
    materialId,
    amount,
    availableEnergy: 1_000,
  });
  return {
    state: { ...state, terrain: result.state },
    effects: [
      ruleEffect(
        "terrain_repaired",
        actor.id,
        null,
        target.x,
        target.y,
        result.repairedIntegrity,
        0,
        {
          route: route ?? "base",
        },
      ),
    ],
  };
}

function resolveReflector(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const route = selectedRoute(actor, "aux_reflector");
  const target = targetPoint(command);
  const field = fieldEffect(
    command,
    "reflector",
    null,
    target,
    route === "reflector_wide_guard" ? 3 : 1,
    route === "reflector_prismatic" ? 2 : 1,
    route === "reflector_wide_guard" ? 1 : 2,
  );
  return appendField(state, field);
}

function resolveEjector(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const route = selectedRoute(actor, "aux_ejector");
  const targetActor = actorAtTargetOrSelf(state, actor, command);
  if (
    targetActor.team !== actor.team ||
    (targetActor.id !== actor.id && manhattanDistance(actor, targetActor) > 1)
  ) {
    throw new Error("ejector target must be self or an adjacent ally");
  }
  const distance = route === "ejector_long_burn" ? 5 : 3;
  const direction = cardinalDirection(command.angleMilliDegrees);
  const destination = {
    x: targetActor.x + direction.x * distance,
    y: targetActor.y + direction.y * distance,
  };
  assertOpenPosition(state, destination.x, destination.y, targetActor.id);
  let next = replaceBattleActor(state, { ...targetActor, ...destination, movementUsed: true });
  const effects = [
    ruleEffect(
      "world_object_moved",
      actor.id,
      targetActor.id,
      destination.x,
      destination.y,
      distance,
      0,
      {
        route: route ?? "base",
      },
    ),
  ];
  if (route === "ejector_tandem" && targetActor.id === actor.id) {
    const ally = next.actors
      .filter(
        (candidate) =>
          candidate.team === actor.team && candidate.id !== actor.id && !candidate.disabled,
      )
      .sort(
        (left, right) =>
          manhattanDistance(actor, left) - manhattanDistance(actor, right) ||
          compareText(left.id, right.id),
      )[0];
    if (ally !== undefined && manhattanDistance(actor, ally) === 1) {
      const tandemDestination = { x: destination.x - direction.x, y: destination.y - direction.y };
      assertOpenPosition(next, tandemDestination.x, tandemDestination.y, ally.id);
      next = replaceBattleActor(next, { ...ally, ...tandemDestination, movementUsed: true });
      effects.push(
        ruleEffect(
          "world_object_moved",
          actor.id,
          ally.id,
          tandemDestination.x,
          tandemDestination.y,
          distance - 1,
          0,
          { route: "ejector_tandem" },
        ),
      );
    }
  }
  return { state: next, effects };
}

function resolveStabilizer(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = actorAtTargetOrSelf(state, actor, command);
  if (target.team !== actor.team) throw new Error("stabilizer can only target allies");
  const route = selectedRoute(actor, "aux_stabilizer");
  const field = fieldEffect(
    command,
    "stabilizer",
    target.id,
    target,
    0,
    route === "stabilizer_anchor" ? 800 : route === "stabilizer_counterforce" ? 600 : 500,
    route === "stabilizer_anchor" ? 3 : 2,
  );
  return appendField(state, field);
}

function resolveRouteScanner(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const route = selectedRoute(actor, "aux_route_scanner");
  const routeRevealDepth = Math.max(
    state.intel.routeRevealDepth,
    route === "route_scanner_deep_intel" ? 4 : 3,
  );
  const trajectoryPreviewPermille = Math.max(
    state.intel.trajectoryPreviewPermille,
    route === "route_scanner_ballistic" ? 1_000 : 750,
  );
  const hiddenTargetIds = [
    ...new Set([
      ...state.intel.hiddenTargetIds,
      ...state.objectives
        .filter((objective) => objective.role === "hidden")
        .map((objective) => objective.id),
    ]),
  ].sort(compareText);
  return {
    state: {
      ...state,
      intel: { ...state.intel, routeRevealDepth, trajectoryPreviewPermille, hiddenTargetIds },
    },
    effects: [
      ruleEffect(
        "intel_revealed",
        actor.id,
        null,
        command.targetX ?? actor.x,
        command.targetY ?? actor.y,
        routeRevealDepth,
        0,
        {
          route: route ?? "base",
          trajectoryPreviewPermille,
        },
      ),
    ],
  };
}

function resolveEnergyRecycler(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = actorAtTargetOrSelf(state, actor, command);
  if (target.team !== actor.team) throw new Error("energy recycler can only target allies");
  const route = selectedRoute(actor, "aux_energy_recycler");
  const targetActorId = route === "energy_recycler_team_loop" ? target.id : actor.id;
  const field = fieldEffect(
    command,
    "energy_recycler",
    targetActorId,
    target,
    0,
    route === "energy_recycler_overclock" ? 3 : route === "energy_recycler_team_loop" ? 2 : 1,
    2,
  );
  return appendField(state, field);
}

function resolveGrapple(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = targetPoint(command);
  const route = selectedRoute(actor, "aux_grapple");
  const maximumDistance = route === "grapple_slingshot" ? 7 : 5;
  if (manhattanDistance(actor, target) > maximumDistance)
    throw new Error("grapple target is out of range");
  assertStandablePosition(state, target.x, target.y, actor.id);
  let next = replaceBattleActor(state, { ...actor, ...target, movementUsed: true });
  const effects = [
    ruleEffect(
      "world_object_moved",
      actor.id,
      actor.id,
      target.x,
      target.y,
      manhattanDistance(actor, target),
      0,
      {
        route: route ?? "base",
      },
    ),
  ];
  if (route === "grapple_rescue_line") {
    const ally = state.actors.find(
      (candidate) =>
        candidate.team === actor.team &&
        candidate.id !== actor.id &&
        manhattanDistance(actor, candidate) === 1,
    );
    if (ally !== undefined) {
      const allyDestination = { x: actor.x, y: actor.y };
      next = replaceBattleActor(next, { ...ally, ...allyDestination, movementUsed: true });
      effects.push(
        ruleEffect(
          "world_object_moved",
          actor.id,
          ally.id,
          allyDestination.x,
          allyDestination.y,
          1,
          0,
          { route: "grapple_rescue_line" },
        ),
      );
    }
  }
  return { state: next, effects };
}

function resolveTerrainFoam(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const target = targetPoint(command);
  if (getTerrainCell(state.terrain, target.x, target.y) !== null)
    throw new Error("terrain foam target must be empty");
  const route = selectedRoute(actor, "aux_terrain_foam");
  const materialId =
    route === "terrain_foam_elastic" ? "terrain_elastic_moss" : "terrain_cloud_soil";
  const amount =
    route === "terrain_foam_reinforced" ? 800 : route === "terrain_foam_elastic" ? 450 : 500;
  const duration = route === "terrain_foam_reinforced" ? 3 : 2;
  const terrain = applyTerrainRepair(state.terrain, {
    ...target,
    materialId,
    amount,
    availableEnergy: 1_000,
  }).state;
  const effectId = effectIdFor(command, "foam");
  return {
    state: {
      ...state,
      terrain,
      temporaryTerrain: [
        ...state.temporaryTerrain,
        { effectId, cells: [target], remainingRounds: duration },
      ],
    },
    effects: [
      ruleEffect("terrain_repaired", actor.id, effectId, target.x, target.y, amount, duration, {
        materialId,
        route: route ?? "base",
      }),
    ],
  };
}

function resolveJammer(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const route = selectedRoute(actor, "aux_jammer");
  const target = targetPoint(command);
  const field = fieldEffect(
    command,
    "jammer",
    null,
    target,
    route === "jammer_decoy" ? 5 : 3,
    route === "jammer_silence" ? 900 : route === "jammer_decoy" ? 500 : 650,
    route === "jammer_decoy" ? 3 : 2,
  );
  return appendField(state, field);
}

function resolveStructureScanner(state: BattleState, command: UseModuleCommand): BattleTransition {
  const actor = findBattleActor(state, command.actorId);
  const route = selectedRoute(actor, "aux_structure_scanner");
  const analysis = analyzeTerrainSupport(state.terrain, { scope: "full" });
  const supportRiskCellIndices = analysis.unstableComponents
    .flat()
    .sort((left, right) => left - right);
  let next: BattleState = {
    ...state,
    intel: { ...state.intel, supportRiskCellIndices },
  };
  const effects = [
    ruleEffect(
      "intel_revealed",
      actor.id,
      null,
      command.targetX ?? actor.x,
      command.targetY ?? actor.y,
      supportRiskCellIndices.length,
      0,
      {
        route: route ?? "base",
        inspectedCells: analysis.inspectedCellCount,
      },
    ),
  ];
  if (route === "structure_scanner_salvage" && supportRiskCellIndices.length > 0) {
    const teamEnergy = actorTeamEnergy(next, actor.team);
    const refund = Math.min(1, teamEnergy.maximum - teamEnergy.current);
    next = replaceActorTeamEnergy(next, actor.team, {
      ...teamEnergy,
      current: teamEnergy.current + refund,
    });
    effects.push(
      ruleEffect("energy_changed", actor.id, null, null, null, refund, 0, {
        reason: "structure_salvage",
        team: actor.team,
      }),
    );
  }
  if (route === "structure_scanner_predictive") {
    next = {
      ...next,
      intel: {
        ...next.intel,
        trajectoryPreviewPermille: Math.max(900, next.intel.trajectoryPreviewPermille),
      },
    };
  }
  return { state: next, effects };
}

function assertModuleUsable(
  state: BattleState,
  actor: BattleActor,
  moduleId: ModuleId,
  command: UseModuleCommand,
  config: BattleRuleConfig,
): void {
  const definition = getModuleDefinition(moduleId);
  if (actor.disabled || actor.actionEnded)
    throw new Error("actor cannot use a module after its action ended");
  if (!actorHasModule(actor, moduleId)) throw new Error(`actor has not equipped ${moduleId}`);
  if (definition.moduleClass === "main" && actor.mainModuleUsed)
    throw new Error("main module already used this round");
  if (
    definition.moduleClass === "auxiliary" &&
    actor.auxiliaryUses >= config.maximumAuxiliaryUsesPerActor
  ) {
    throw new Error("actor auxiliary action limit reached");
  }
  if (actorCooldown(actor, moduleId) > 0) throw new Error(`module is cooling down: ${moduleId}`);
  const cost = effectiveModuleEnergyCost(actor, moduleId);
  if (actorTeamEnergy(state, actor.team).current < cost) {
    throw new Error(`insufficient team energy for ${moduleId}`);
  }
  if (command.originX !== actor.x || command.originY !== actor.y) {
    throw new Error("module origin must match the authoritative actor position");
  }
  if (command.targetX !== undefined && command.targetY !== undefined) {
    const route = selectedRoute(actor, moduleId);
    const rangeBonus =
      route === "drill_bee_deep_bore" ||
      route === "ejector_long_burn" ||
      route === "grapple_slingshot"
        ? 2
        : 0;
    const aimingFault = actor.faults.find((fault) => fault.kind === "aiming_fault");
    const rangePenalty = aimingFault === undefined ? 0 : aimingFault.severity === "major" ? 2 : 1;
    const effectiveRange = Math.max(1, definition.maximumRange + rangeBonus - rangePenalty);
    if (manhattanDistance(actor, { x: command.targetX, y: command.targetY }) > effectiveRange) {
      throw new Error(`module target is out of range: ${moduleId}`);
    }
    if (!isTerrainPointInBounds(state.terrain, command.targetX, command.targetY)) {
      throw new Error("module target must be inside terrain bounds");
    }
  }
  if (command.targetId !== undefined) {
    const actorTarget = state.actors.some(
      (candidate) =>
        candidate.id === command.targetId &&
        !candidate.disabled &&
        candidate.x === command.targetX &&
        candidate.y === command.targetY,
    );
    const objectTarget = state.worldObjects.some(
      (candidate) =>
        candidate.id === command.targetId &&
        candidate.active &&
        candidate.x === command.targetX &&
        candidate.y === command.targetY,
    );
    if (!actorTarget && !objectTarget) {
      throw new Error("module target id does not match an active entity at the target coordinates");
    }
  }
}

function targetPoint(command: UseModuleCommand): { readonly x: number; readonly y: number } {
  if (command.targetX === undefined || command.targetY === undefined) {
    throw new Error(`module ${command.moduleId} requires a target point`);
  }
  return { x: command.targetX, y: command.targetY };
}

function actorAtTargetOrSelf(
  state: BattleState,
  actor: BattleActor,
  command: UseModuleCommand,
): BattleActor {
  if (command.targetX === undefined || command.targetY === undefined) return actor;
  const target = state.actors.find(
    (candidate) =>
      !candidate.disabled && candidate.x === command.targetX && candidate.y === command.targetY,
  );
  if (target === undefined) throw new Error("module target actor not found");
  return target;
}

function appendField(state: BattleState, field: BattleFieldEffect): BattleTransition {
  if (state.fieldEffects.some((candidate) => candidate.id === field.id)) {
    throw new Error(`field effect already exists: ${field.id}`);
  }
  return {
    state: { ...state, fieldEffects: [...state.fieldEffects, field] },
    effects: [fieldCreatedEffect(field)],
  };
}

function fieldEffect(
  command: UseModuleCommand,
  kind: BattleFieldEffect["kind"],
  targetActorId: string | null,
  target: { readonly x: number; readonly y: number },
  radius: number,
  magnitude: number,
  remainingRounds: number,
): BattleFieldEffect {
  return {
    id: effectIdFor(command, kind),
    kind,
    sourceActorId: command.actorId,
    targetActorId,
    x: target.x,
    y: target.y,
    radius,
    directionMilliDegrees: command.angleMilliDegrees,
    magnitude,
    remainingRounds,
    consumed: false,
  };
}

function fieldCreatedEffect(field: BattleFieldEffect): BattleRuleEffect {
  return ruleEffect(
    "field_created",
    field.sourceActorId,
    field.id,
    field.x,
    field.y,
    field.magnitude,
    field.remainingRounds,
    { fieldKind: field.kind, targetActorId: field.targetActorId },
  );
}

function effectIdFor(command: UseModuleCommand, suffix: string): string {
  return `effect:${command.turnIndex}:${command.commandId}:${suffix}`;
}

function setCooldown(
  cooldowns: BattleActor["cooldowns"],
  moduleId: ModuleId,
  remainingRounds: number,
): BattleActor["cooldowns"] {
  return [
    ...cooldowns.filter((cooldown) => cooldown.moduleId !== moduleId),
    { moduleId, remainingRounds },
  ].sort((left, right) => compareText(left.moduleId, right.moduleId));
}

function assertOpenPosition(state: BattleState, x: number, y: number, ignoredId: string): void {
  if (!isTerrainPointInBounds(state.terrain, x, y))
    throw new Error("destination is outside terrain");
  if (getTerrainCell(state.terrain, x, y) !== null) throw new Error("destination contains terrain");
  if (
    state.actors.some(
      (actor) => actor.id !== ignoredId && !actor.disabled && actor.x === x && actor.y === y,
    )
  ) {
    throw new Error("destination contains an actor");
  }
  if (
    state.worldObjects.some(
      (object) => object.id !== ignoredId && object.active && object.x === x && object.y === y,
    )
  ) {
    throw new Error("destination contains a world object");
  }
}

function assertStandablePosition(
  state: BattleState,
  x: number,
  y: number,
  ignoredId: string,
): void {
  assertOpenPosition(state, x, y, ignoredId);
  if (y === 0 || getTerrainCell(state.terrain, x, y - 1) === null) {
    throw new Error("destination is not standable");
  }
  const support = analyzeTerrainSupport(state.terrain, { scope: "full" });
  if (!support.supportedCellIndices.includes(terrainIndex(state.terrain.width, x, y - 1))) {
    throw new Error("destination support is unstable");
  }
}

function stepToward(
  source: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number },
  distance: number,
): { readonly x: number; readonly y: number } {
  let x = source.x;
  let y = source.y;
  for (let step = 0; step < distance; step += 1) {
    if (x !== target.x) x += Math.sign(target.x - x);
    else if (y !== target.y) y += Math.sign(target.y - y);
  }
  return { x, y };
}

function horizontalCells(
  startX: number,
  endX: number,
  y: number,
  direction: number,
): { readonly x: number; readonly y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let x = startX; direction > 0 ? x <= endX : x >= endX; x += direction) cells.push({ x, y });
  return cells;
}

function traceLine(
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number }[] {
  const points: { x: number; y: number }[] = [];
  let x = start.x;
  let y = start.y;
  const deltaX = Math.abs(end.x - start.x);
  const stepX = start.x < end.x ? 1 : -1;
  const deltaY = -Math.abs(end.y - start.y);
  const stepY = start.y < end.y ? 1 : -1;
  let error = deltaX + deltaY;
  for (;;) {
    points.push({ x, y });
    if (x === end.x && y === end.y) break;
    const doubleError = error * 2;
    if (doubleError >= deltaY) {
      error += deltaY;
      x += stepX;
    }
    if (doubleError <= deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
  return points;
}

function cardinalDirection(angleMilliDegrees: number): { readonly x: number; readonly y: number } {
  const quadrant = Math.floor(((angleMilliDegrees + 45_000) % 360_000) / 90_000);
  switch (quadrant) {
    case 0:
      return { x: 1, y: 0 };
    case 1:
      return { x: 0, y: 1 };
    case 2:
      return { x: -1, y: 0 };
    case 3:
      return { x: 0, y: -1 };
    default:
      throw new Error("invalid cardinal direction");
  }
}

function ruleEffect(
  kind: BattleRuleEffect["kind"],
  sourceId: string,
  targetId: string | null,
  targetX: number | null,
  targetY: number | null,
  magnitude: number,
  duration: number,
  details: BattleRuleEffect["details"],
): BattleRuleEffect {
  return { kind, sourceId, targetId, targetX, targetY, magnitude, duration, details };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
