import {
  effectiveModuleEnergyCost,
  jammerTargetScoreModifier,
  manhattanDistance,
} from "@skymenders/battle-core";
import type { BattleActor, BattleState, ModuleId } from "@skymenders/battle-core";
import type { BattleCommand } from "@skymenders/protocol";

import type {
  AiCandidateSeed,
  AiDifficultyProfile,
  AiGoal,
  AiUtilityVector,
  AiUtilityWeights,
} from "./types.js";

const DAMAGE_MODULES = new Set<ModuleId>([
  "main_drill_bee",
  "main_magnetic_anchor",
  "main_energy_rail",
]);
const TERRAIN_MODULES = new Set<ModuleId>([
  "main_fold_bridge",
  "main_drill_bee",
  "main_support_frame",
  "aux_repair_spray",
  "aux_terrain_foam",
  "aux_structure_scanner",
]);
const SAFETY_MODULES = new Set<ModuleId>([
  "main_bubble_capsule",
  "main_support_frame",
  "aux_repair_spray",
  "aux_ejector",
  "aux_stabilizer",
  "aux_grapple",
  "aux_terrain_foam",
]);
const CONTROL_MODULES = new Set<ModuleId>([
  "main_magnetic_anchor",
  "main_gravity_pin",
  "main_bubble_capsule",
  "main_wind_generator",
  "main_energy_rail",
  "aux_reflector",
  "aux_jammer",
]);

export interface AiScoringContext {
  readonly battle: BattleState;
  readonly actor: BattleActor;
  readonly candidate: AiCandidateSeed;
  readonly goal: AiGoal;
  readonly weights: AiUtilityWeights;
  readonly difficulty: AiDifficultyProfile;
  readonly preferredModules: readonly ModuleId[];
}

export function scoreAiCandidate(context: AiScoringContext): {
  readonly utility: AiUtilityVector;
  readonly weightedScore: number;
} {
  const { battle, actor, candidate, goal, weights, difficulty, preferredModules } = context;
  const command = candidate.command;
  const target = commandTarget(battle, command, actor);
  const moduleId = command.kind === "use_module" ? (command.moduleId as ModuleId) : null;
  const targetActor =
    "targetId" in command
      ? battle.actors.find((candidateActor) => candidateActor.id === command.targetId)
      : undefined;
  const targetTeam = targetActor?.team;
  const isHostileTarget =
    targetTeam !== undefined && targetTeam !== actor.team && targetTeam !== "neutral";
  const isFriendlyTarget = targetTeam === actor.team;
  const objectiveMatch = battle.objectives.some(
    (objective) =>
      objective.status === "active" &&
      (("targetId" in command && objective.targetId === command.targetId) ||
        (moduleId !== null && objective.requiredModuleId === moduleId)),
  );
  const nearestHostileBefore = nearestHostileDistance(battle, actor, actor.x, actor.y);
  const nearestHostileAfter = nearestHostileDistance(battle, actor, target.x, target.y);
  const hpMissingPermille = Math.trunc(((actor.maxHp - actor.hp) * 1_000) / actor.maxHp);

  const taskBenefit = scaleAwareness(
    objectiveMatch
      ? 120
      : goal === "secure_objective" && command.kind === "move"
        ? 55
        : moduleId === "aux_route_scanner"
          ? 35
          : 0,
    difficulty.objectiveAwarenessPermille,
  );
  const expectedDamage =
    moduleId !== null && DAMAGE_MODULES.has(moduleId)
      ? isHostileTarget
        ? 105
        : targetActor === undefined
          ? 65
          : 5
      : command.kind === "use_basic_action" && command.action === "push" && isHostileTarget
        ? 45
        : 0;
  const terrainBenefit =
    moduleId !== null && TERRAIN_MODULES.has(moduleId)
      ? moduleId === "main_drill_bee"
        ? 95
        : goal === "disrupt_support"
          ? 80
          : 55
      : 0;
  const selfSafety =
    (moduleId !== null && SAFETY_MODULES.has(moduleId) ? 45 + hpMissingPermille / 10 : 0) +
    (command.kind === "use_basic_action" && command.action === "repair" ? 70 : 0) +
    (command.kind === "move" && nearestHostileAfter > nearestHostileBefore ? 35 : 0);
  const controlBenefit =
    moduleId !== null && CONTROL_MODULES.has(moduleId)
      ? isHostileTarget || targetActor === undefined
        ? 85
        : 35
      : 0;
  const energyCost = moduleId === null ? 0 : effectiveModuleEnergyCost(actor, moduleId) * 18;
  const friendlyFireRisk =
    isFriendlyTarget &&
    ((moduleId !== null && DAMAGE_MODULES.has(moduleId)) ||
      (command.kind === "use_basic_action" && command.action === "push"))
      ? 110
      : moduleId === "main_drill_bee" &&
          nearestFriendlyDistance(battle, actor, target.x, target.y) <= 1
        ? 70
        : 0;
  const fallRisk = scaleAwareness(
    moduleId === "main_drill_bee" && target.y <= actor.y ? 75 : 0,
    difficulty.hazardAwarenessPermille,
  );
  const exposureRisk = scaleAwareness(
    command.kind === "move" && nearestHostileAfter < nearestHostileBefore
      ? Math.max(0, 70 - nearestHostileAfter * 8)
      : 0,
    difficulty.hazardAwarenessPermille,
  );
  const utility: AiUtilityVector = Object.freeze({
    taskBenefit,
    expectedDamage,
    terrainBenefit,
    selfSafety: Math.trunc(selfSafety),
    controlBenefit,
    energyCost,
    friendlyFireRisk,
    fallRisk,
    exposureRisk,
  });
  let weightedScore =
    utility.taskBenefit * weights.taskBenefit +
    utility.expectedDamage * weights.expectedDamage +
    utility.terrainBenefit * weights.terrainBenefit +
    utility.selfSafety * weights.selfSafety +
    utility.controlBenefit * weights.controlBenefit -
    utility.energyCost * weights.energyCost -
    utility.friendlyFireRisk * weights.friendlyFireRisk -
    utility.fallRisk * weights.fallRisk -
    utility.exposureRisk * weights.exposureRisk;
  weightedScore += goalAlignment(goal, command, moduleId) * 100;
  if (moduleId !== null && preferredModules.includes(moduleId)) weightedScore += 4_000;
  weightedScore += jammerTargetScoreModifier(battle, target.x, target.y) * 100;
  if (command.kind === "wait") weightedScore -= 2_500;
  return { utility, weightedScore: Math.trunc(weightedScore) };
}

function goalAlignment(goal: AiGoal, command: BattleCommand, moduleId: ModuleId | null): number {
  switch (goal) {
    case "recover":
      return (moduleId !== null && SAFETY_MODULES.has(moduleId)) ||
        (command.kind === "use_basic_action" && command.action === "repair")
        ? 80
        : 0;
    case "secure_objective":
      return moduleId === "main_magnetic_anchor" || command.kind === "move" ? 75 : 0;
    case "disrupt_support":
      return moduleId === "main_drill_bee" || moduleId === "aux_structure_scanner" ? 85 : 0;
    case "control_field":
      return moduleId !== null && CONTROL_MODULES.has(moduleId) ? 80 : 0;
    case "pressure_target":
      return moduleId !== null && DAMAGE_MODULES.has(moduleId) ? 80 : 0;
    case "reposition":
      return command.kind === "move" || moduleId === "aux_grapple" ? 70 : 0;
    case "wait":
      return command.kind === "wait" ? 40 : 0;
  }
}

function commandTarget(
  battle: BattleState,
  command: BattleCommand,
  actor: BattleActor,
): { readonly x: number; readonly y: number } {
  if (command.kind === "move") return { x: command.destinationX, y: command.destinationY };
  if (
    (command.kind === "use_module" || command.kind === "use_basic_action") &&
    command.targetX !== undefined &&
    command.targetY !== undefined
  ) {
    return { x: command.targetX, y: command.targetY };
  }
  if ("targetId" in command) {
    const target =
      battle.actors.find((candidate) => candidate.id === command.targetId) ??
      battle.worldObjects.find((candidate) => candidate.id === command.targetId);
    if (target !== undefined) return target;
  }
  return actor;
}

function nearestHostileDistance(
  battle: BattleState,
  actor: BattleActor,
  x: number,
  y: number,
): number {
  const distances = battle.actors
    .filter(
      (candidate) =>
        candidate.team !== actor.team && candidate.team !== "neutral" && !candidate.disabled,
    )
    .map((candidate) => manhattanDistance({ x, y }, candidate));
  return distances.length === 0
    ? battle.terrain.width + battle.terrain.height
    : Math.min(...distances);
}

function nearestFriendlyDistance(
  battle: BattleState,
  actor: BattleActor,
  x: number,
  y: number,
): number {
  const distances = battle.actors
    .filter(
      (candidate) =>
        candidate.id !== actor.id && candidate.team === actor.team && !candidate.disabled,
    )
    .map((candidate) => manhattanDistance({ x, y }, candidate));
  return distances.length === 0
    ? battle.terrain.width + battle.terrain.height
    : Math.min(...distances);
}

function scaleAwareness(value: number, permille: number): number {
  return Math.trunc((value * permille) / 1_000);
}
