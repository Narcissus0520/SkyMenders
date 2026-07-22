import {
  assertBattleState,
  effectiveMoveDistance,
  getModuleDefinition,
  manhattanDistance,
  reduceBattleCommand,
} from "@skymenders/battle-core";
import type { BattleActor, BattleState, ModuleId, ModuleTargetMode } from "@skymenders/battle-core";
import { nextInteger } from "@skymenders/deterministic-runtime";
import type { RngState } from "@skymenders/deterministic-runtime";
import type { BattleCommand, UseModuleCommand } from "@skymenders/protocol";

import { DEFAULT_ENEMY_BEHAVIOR_TREE, evaluateBehaviorTree } from "./behavior-tree.js";
import {
  AI_DIFFICULTY_PROFILES,
  eliteAffixes,
  getBossDefinition,
  getEliteTemplate,
  getEnemyDefinition,
  mergedUtilityWeights,
} from "./catalog.js";
import { assertAiAuthorityState, findAiController, findBossRuntime } from "./state.js";
import { scoreAiCandidate } from "./utility.js";
import { assertAiBattleBindings } from "./validator.js";
import { AI_MAX_CANDIDATES, AI_MAX_DECISIONS } from "./types.js";
import type {
  AiAuthorityState,
  AiBehaviorFlag,
  AiCandidateEvaluation,
  AiCandidateSeed,
  AiDecision,
  AiDecisionTrace,
  AiDifficultyProfile,
  AiEnemyPhaseExecution,
  AiGoal,
  AiUtilityVector,
  AiUtilityWeights,
} from "./types.js";

const ZERO_UTILITY: AiUtilityVector = Object.freeze({
  taskBenefit: 0,
  expectedDamage: 0,
  terrainBenefit: 0,
  selfSafety: 0,
  controlBenefit: 0,
  energyCost: 0,
  friendlyFireRisk: 0,
  fallRisk: 0,
  exposureRisk: 0,
});

interface ResolvedControllerProfile {
  readonly flags: readonly AiBehaviorFlag[];
  readonly weights: AiUtilityWeights;
  readonly preferredGoals: readonly AiGoal[];
  readonly preferredModules: readonly ModuleId[];
  readonly forcedGoal: AiGoal | null;
}

interface CandidateTarget {
  readonly x: number;
  readonly y: number;
  readonly targetId?: string;
}

export function planAiAction(
  battle: BattleState,
  state: AiAuthorityState,
  actorId: string,
): AiDecision {
  assertBattleState(battle);
  assertAiAuthorityState(state);
  assertAiBattleBindings(battle, state);
  if (battle.phase !== "enemy_action") throw new Error("AI can plan only during enemy action");
  if (state.decisionIndex >= AI_MAX_DECISIONS) throw new RangeError("AI decision log is full");
  const actor = battle.actors.find((candidate) => candidate.id === actorId);
  if (actor?.team !== "enemy" || actor.disabled) {
    throw new Error(`AI actor is not active enemy authority: ${actorId}`);
  }
  if (actor.actionEnded) throw new Error(`AI actor action has already ended: ${actorId}`);
  const controller = findAiController(state, actorId);
  const controllerProfile = resolveControllerProfile(state, controller);
  const behavior = evaluateBehaviorTree(DEFAULT_ENEMY_BEHAVIOR_TREE, {
    battle,
    actor,
    flags: controllerProfile.flags,
    forcedGoal: controllerProfile.forcedGoal,
  });
  const difficulty = AI_DIFFICULTY_PROFILES[state.difficulty];
  const seeds = generateCandidateSeeds(
    battle,
    actor,
    behavior.goal,
    difficulty,
    state.decisionIndex,
  );
  const evaluations = seeds.map((candidate) =>
    evaluateCandidate(
      battle,
      actor,
      candidate,
      behavior.goal,
      controllerProfile.weights,
      difficulty,
      controllerProfile.preferredModules,
      state.decisionIndex,
    ),
  );
  const legal = evaluations.filter((candidate) => candidate.legal);
  if (legal.length === 0) throw new Error(`AI produced no legal command for ${actorId}`);
  const bestScore = Math.max(...legal.map((candidate) => candidate.weightedScore));
  const tied = legal
    .filter((candidate) => candidate.weightedScore === bestScore)
    .sort(compareCandidate);
  const tieBreak = nextInteger(state.aiRngState, 0, tied.length - 1);
  const selected = tied[tieBreak.value];
  if (selected === undefined) throw new Error("AI tie-break selected no candidate");
  const aimed = applyAimError(selected.command, difficulty, state.aimErrorRngState);
  try {
    reduceBattleCommand(battle, aimed.command, state.decisionIndex);
  } catch (error) {
    throw new Error(
      `AI selected command failed authority validation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const nextState: AiAuthorityState = {
    ...state,
    decisionIndex: state.decisionIndex + 1,
    aiRngState: tieBreak.state,
    aimErrorRngState: aimed.rngState,
  };
  assertAiAuthorityState(nextState);
  const trace: AiDecisionTrace = {
    actorId,
    turnIndex: battle.turnIndex,
    decisionIndex: state.decisionIndex,
    difficulty: state.difficulty,
    selectedGoal: behavior.goal,
    selectedCandidateId: selected.candidateId,
    selectedScore: selected.weightedScore,
    angleErrorMilliDegrees: aimed.angleErrorMilliDegrees,
    powerErrorPermille: aimed.powerErrorPermille,
    behaviorTrace: behavior.trace,
    candidates: evaluations,
  };
  return { state: nextState, command: aimed.command, trace };
}

export function executeAiEnemyPhase(
  battle: BattleState,
  state: AiAuthorityState,
  startingCommandIndex = 0,
): AiEnemyPhaseExecution {
  assertAiBattleBindings(battle, state);
  if (battle.phase !== "enemy_action") throw new Error("AI phase executor requires enemy_action");
  if (!Number.isSafeInteger(startingCommandIndex) || startingCommandIndex < 0) {
    throw new RangeError("AI phase command index must be non-negative");
  }
  let nextBattle = battle;
  let nextAi = state;
  const commands: BattleCommand[] = [];
  const events: AiEnemyPhaseExecution["events"][number][] = [];
  const traces: AiDecisionTrace[] = [];
  const actorIds = nextBattle.actors
    .filter((actor) => actor.team === "enemy" && !actor.disabled)
    .map((actor) => actor.id)
    .sort(compareText);
  for (const actorId of actorIds) {
    for (let actionCount = 0; actionCount < 5; actionCount += 1) {
      const actor = nextBattle.actors.find((candidate) => candidate.id === actorId);
      if (actor === undefined || actor.disabled || actor.actionEnded) break;
      const decision = planAiAction(nextBattle, nextAi, actorId);
      const result = reduceBattleCommand(
        nextBattle,
        decision.command,
        startingCommandIndex + commands.length,
      );
      nextBattle = result.state;
      nextAi = decision.state;
      commands.push(decision.command);
      events.push(...result.events);
      traces.push(decision.trace);
    }
    const settledActor = nextBattle.actors.find((candidate) => candidate.id === actorId);
    if (settledActor !== undefined && !settledActor.disabled && !settledActor.actionEnded) {
      throw new Error(`AI exceeded the bounded per-actor action sequence: ${actorId}`);
    }
  }
  return { battleState: nextBattle, aiState: nextAi, commands, events, traces };
}

function resolveControllerProfile(
  state: AiAuthorityState,
  controller: AiAuthorityState["controllers"][number],
): ResolvedControllerProfile {
  if (controller.prototypeId !== null) {
    const definition = getEnemyDefinition(controller.prototypeId);
    const template =
      controller.eliteTemplateId === null ? null : getEliteTemplate(controller.eliteTemplateId);
    const affixIds = template?.affixIds ?? [];
    const affixes = eliteAffixes(controller.eliteTemplateId);
    return {
      flags: definition.flags,
      weights: mergedUtilityWeights(definition.utilityWeights, affixIds),
      preferredGoals: definition.preferredGoals,
      preferredModules: uniqueStrings([
        ...affixes.flatMap((affix) => affix.preferredModules),
        definition.mainModuleId,
      ]),
      forcedGoal: null,
    };
  }
  if (controller.bossId === null) throw new Error("AI controller has no catalog profile");
  const definition = getBossDefinition(controller.bossId);
  const runtime = findBossRuntime(state, controller.bossId);
  const stage = definition.stages[runtime.stageIndex];
  if (stage === undefined) throw new Error("boss stage profile is missing");
  if (runtime.completed) {
    return {
      flags: [],
      weights: definition.utilityWeights,
      preferredGoals: ["wait"],
      preferredModules: [],
      forcedGoal: "wait",
    };
  }
  return {
    flags: ["field_controller", "support_disruptor", "protector"],
    weights: definition.utilityWeights,
    preferredGoals: [stage.preferredGoal],
    preferredModules: stage.preferredModules,
    forcedGoal: stage.preferredGoal,
  };
}

function generateCandidateSeeds(
  battle: BattleState,
  actor: BattleActor,
  goal: AiGoal,
  difficulty: AiDifficultyProfile,
  decisionIndex: number,
): readonly AiCandidateSeed[] {
  const candidates: AiCandidateSeed[] = [];
  let serial = 0;
  const add = (command: BattleCommand): void => {
    if (candidates.length >= Math.min(difficulty.maximumCandidates, AI_MAX_CANDIDATES)) return;
    candidates.push({ candidateId: `candidate:${pad(serial)}`, goal, command });
    serial += 1;
  };
  add({
    kind: "wait",
    ...commandBase(battle, actor, decisionIndex, serial),
  });
  if (goal === "wait") return candidates;
  if (!actor.movementUsed) {
    for (const destination of movementTargets(battle, actor, goal, difficulty)) {
      add({
        kind: "move",
        ...commandBase(battle, actor, decisionIndex, serial),
        destinationX: destination.x,
        destinationY: destination.y,
      });
    }
  }
  for (const target of battle.actors) {
    if (target.disabled || target.id === actor.id || manhattanDistance(actor, target) > 1) continue;
    if (target.team === actor.team && target.hp < target.maxHp) {
      add({
        kind: "use_basic_action",
        ...commandBase(battle, actor, decisionIndex, serial),
        action: "repair",
        targetId: target.id,
      });
    } else {
      add({
        kind: "use_basic_action",
        ...commandBase(battle, actor, decisionIndex, serial),
        action: "push",
        targetId: target.id,
      });
    }
  }
  for (const target of battle.worldObjects) {
    if (!target.active || manhattanDistance(actor, target) > 1) continue;
    add({
      kind: "use_basic_action",
      ...commandBase(battle, actor, decisionIndex, serial),
      action: "push",
      targetId: target.id,
    });
  }
  for (const moduleId of [actor.mainModuleId, ...actor.auxiliaryModuleIds]) {
    const definition = getModuleDefinition(moduleId);
    const targets = moduleTargets(battle, actor, definition.targetMode, difficulty);
    for (const target of targets) {
      const distance = manhattanDistance(actor, target);
      const command: UseModuleCommand = {
        kind: "use_module",
        ...commandBase(battle, actor, decisionIndex, serial),
        moduleId,
        originX: actor.x,
        originY: actor.y,
        angleMilliDegrees: cardinalAngle(actor, target),
        powerPermille: clamp(350 + distance * 90, 0, 1_000),
        targetX: target.x,
        targetY: target.y,
        ...(target.targetId === undefined ? {} : { targetId: target.targetId }),
      };
      add(command);
    }
    if (definition.targetMode === "self_or_actor") {
      add({
        kind: "use_module",
        ...commandBase(battle, actor, decisionIndex, serial),
        moduleId,
        originX: actor.x,
        originY: actor.y,
        angleMilliDegrees: 0,
        powerPermille: 500,
      });
    }
  }
  return candidates;
}

function movementTargets(
  battle: BattleState,
  actor: BattleActor,
  goal: AiGoal,
  difficulty: AiDifficultyProfile,
): readonly CandidateTarget[] {
  const maximumDistance = effectiveMoveDistance(actor, battle.config);
  const candidates: CandidateTarget[] = [];
  for (let y = 0; y < battle.terrain.height; y += 1) {
    for (let x = 0; x < battle.terrain.width; x += 1) {
      const point = { x, y };
      const distance = manhattanDistance(actor, point);
      if (distance > 0 && distance <= maximumDistance) candidates.push(point);
    }
  }
  candidates.sort((left, right) => {
    const leftScore = positionalPriority(battle, actor, goal, left);
    const rightScore = positionalPriority(battle, actor, goal, right);
    return rightScore - leftScore || left.y - right.y || left.x - right.x;
  });
  return candidates.slice(0, difficulty.maximumMoveCandidates);
}

function moduleTargets(
  battle: BattleState,
  actor: BattleActor,
  targetMode: ModuleTargetMode,
  difficulty: AiDifficultyProfile,
): readonly CandidateTarget[] {
  const candidates: CandidateTarget[] = [];
  if (targetMode === "actor" || targetMode === "self_or_actor") {
    for (const target of battle.actors) {
      if (!target.disabled) candidates.push({ x: target.x, y: target.y, targetId: target.id });
    }
  } else if (targetMode === "object") {
    for (const object of battle.worldObjects) {
      if (object.active) candidates.push({ x: object.x, y: object.y, targetId: object.id });
    }
    for (const target of battle.actors) {
      if (!target.disabled && target.id !== actor.id) {
        candidates.push({ x: target.x, y: target.y, targetId: target.id });
      }
    }
  } else {
    for (const target of battle.actors) {
      if (!target.disabled) candidates.push({ x: target.x, y: target.y, targetId: target.id });
    }
    for (const object of battle.worldObjects) {
      if (object.active) candidates.push({ x: object.x, y: object.y, targetId: object.id });
    }
    const maximumRange = 10;
    for (let y = 0; y < battle.terrain.height; y += 1) {
      for (let x = 0; x < battle.terrain.width; x += 1) {
        if (manhattanDistance(actor, { x, y }) <= maximumRange) candidates.push({ x, y });
      }
    }
  }
  const unique = new Map<string, CandidateTarget>();
  for (const target of candidates) {
    const key = target.targetId ?? `${target.x}:${target.y}`;
    if (!unique.has(key)) unique.set(key, target);
  }
  return [...unique.values()]
    .sort(
      (left, right) =>
        targetPriority(battle, actor, right) - targetPriority(battle, actor, left) ||
        left.y - right.y ||
        left.x - right.x ||
        compareText(left.targetId ?? "", right.targetId ?? ""),
    )
    .slice(0, difficulty.maximumTargetCandidatesPerModule);
}

function evaluateCandidate(
  battle: BattleState,
  actor: BattleActor,
  candidate: AiCandidateSeed,
  goal: AiGoal,
  weights: AiUtilityWeights,
  difficulty: AiDifficultyProfile,
  preferredModules: readonly ModuleId[],
  commandIndex: number,
): AiCandidateEvaluation {
  try {
    reduceBattleCommand(battle, candidate.command, commandIndex);
    const scored = scoreAiCandidate({
      battle,
      actor,
      candidate,
      goal,
      weights,
      difficulty,
      preferredModules,
    });
    return { ...candidate, legal: true, rejection: null, ...scored };
  } catch (error) {
    return {
      ...candidate,
      legal: false,
      rejection: error instanceof Error ? error.message : String(error),
      utility: ZERO_UTILITY,
      weightedScore: Number.MIN_SAFE_INTEGER,
    };
  }
}

function applyAimError(
  command: BattleCommand,
  difficulty: AiDifficultyProfile,
  rngState: RngState,
): {
  readonly command: BattleCommand;
  readonly rngState: RngState;
  readonly angleErrorMilliDegrees: number;
  readonly powerErrorPermille: number;
} {
  if (command.kind !== "use_module") {
    return { command, rngState, angleErrorMilliDegrees: 0, powerErrorPermille: 0 };
  }
  const angle = nextInteger(
    rngState,
    -difficulty.angleErrorMilliDegrees,
    difficulty.angleErrorMilliDegrees,
  );
  const power = nextInteger(
    angle.state,
    -difficulty.powerErrorPermille,
    difficulty.powerErrorPermille,
  );
  return {
    command: {
      ...command,
      angleMilliDegrees: normalizeAngle(command.angleMilliDegrees + angle.value),
      powerPermille: clamp(command.powerPermille + power.value, 0, 1_000),
    },
    rngState: power.state,
    angleErrorMilliDegrees: angle.value,
    powerErrorPermille: power.value,
  };
}

function commandBase(
  battle: BattleState,
  actor: BattleActor,
  decisionIndex: number,
  serial: number,
) {
  return {
    commandId: `ai:${battle.turnIndex}:${decisionIndex}:${pad(serial)}`,
    battleId: battle.battleId,
    turnIndex: battle.turnIndex,
    actorId: actor.id,
  } as const;
}

function positionalPriority(
  battle: BattleState,
  actor: BattleActor,
  goal: AiGoal,
  point: CandidateTarget,
): number {
  const hostiles = battle.actors.filter(
    (candidate) =>
      candidate.team !== actor.team && candidate.team !== "neutral" && !candidate.disabled,
  );
  const nearestHostile =
    hostiles.length === 0
      ? 100
      : Math.min(...hostiles.map((candidate) => manhattanDistance(point, candidate)));
  const taskObjects = battle.worldObjects.filter(
    (object) => object.active && object.kind === "task_object",
  );
  const nearestTask =
    taskObjects.length === 0
      ? 100
      : Math.min(...taskObjects.map((object) => manhattanDistance(point, object)));
  if (goal === "secure_objective") return 100 - nearestTask * 8;
  if (goal === "recover" || goal === "reposition") return nearestHostile * 7;
  return 100 - nearestHostile * 6;
}

function targetPriority(battle: BattleState, actor: BattleActor, target: CandidateTarget): number {
  const targetActor =
    target.targetId === undefined
      ? undefined
      : battle.actors.find((candidate) => candidate.id === target.targetId);
  const objective = battle.objectives.some(
    (candidate) => candidate.status === "active" && candidate.targetId === target.targetId,
  );
  return (
    (objective ? 500 : 0) +
    (targetActor !== undefined && targetActor.team !== actor.team ? 250 : 0) +
    (target.targetId !== undefined ? 100 : 0) -
    manhattanDistance(actor, target)
  );
}

function cardinalAngle(
  origin: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number },
): number {
  const deltaX = target.x - origin.x;
  const deltaY = target.y - origin.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX >= 0 ? 0 : 180_000;
  return deltaY >= 0 ? 90_000 : 270_000;
}

function normalizeAngle(value: number): number {
  return ((value % 360_000) + 360_000) % 360_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function pad(value: number): string {
  return value.toString().padStart(3, "0");
}

function uniqueStrings<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort(compareText);
}

function compareCandidate(left: AiCandidateEvaluation, right: AiCandidateEvaluation): number {
  return compareText(left.candidateId, right.candidateId);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
