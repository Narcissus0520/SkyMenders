import { deriveRngState, validateRngState } from "@skymenders/deterministic-runtime";

import { getBossDefinition, getEliteTemplate } from "./catalog.js";
import {
  AI_DIFFICULTIES,
  AI_MAX_BOSSES,
  AI_MAX_BOSS_COUNTERS,
  AI_MAX_CONTROLLERS,
  AI_MAX_DECISIONS,
  AI_RULES_VERSION,
  AI_SCHEMA_VERSION,
  BOSS_IDS,
  ELITE_TEMPLATE_IDS,
  ENEMY_PROTOTYPE_IDS,
} from "./types.js";
import type {
  AiAuthorityState,
  AiControllerState,
  BossId,
  BossRuntimeState,
  CreateAiAuthorityDefinition,
} from "./types.js";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const UINT32_MAXIMUM = 0xffff_ffff;

export function createAiAuthorityState(definition: CreateAiAuthorityDefinition): AiAuthorityState {
  const bosses = definition.controllers
    .flatMap((controller) =>
      controller.bossId === null ? [] : [createBossRuntime(controller.bossId)],
    )
    .sort(compareBoss);
  const state: AiAuthorityState = {
    schemaVersion: AI_SCHEMA_VERSION,
    rulesVersion: AI_RULES_VERSION,
    rootSeed: definition.rootSeed,
    difficulty: definition.difficulty,
    decisionIndex: 0,
    aiRngState: deriveRngState(definition.rootSeed, "ai"),
    aimErrorRngState: deriveRngState(definition.rootSeed, "aim_error"),
    controllers: [...definition.controllers].sort(compareController),
    bosses,
  };
  assertAiAuthorityState(state);
  return state;
}

export function assertAiAuthorityState(state: AiAuthorityState): void {
  if (state.schemaVersion !== AI_SCHEMA_VERSION) {
    throw new Error(`unsupported AI schema: ${state.schemaVersion}`);
  }
  if (state.rulesVersion !== AI_RULES_VERSION) {
    throw new Error(`unsupported AI rules: ${state.rulesVersion}`);
  }
  if (!Number.isInteger(state.rootSeed) || state.rootSeed < 0 || state.rootSeed > UINT32_MAXIMUM) {
    throw new RangeError("AI root seed must be a uint32");
  }
  if (!AI_DIFFICULTIES.includes(state.difficulty)) throw new Error("AI difficulty is invalid");
  if (
    !Number.isSafeInteger(state.decisionIndex) ||
    state.decisionIndex < 0 ||
    state.decisionIndex > AI_MAX_DECISIONS
  ) {
    throw new RangeError("AI decision index is outside the supported range");
  }
  validateRngState(state.aiRngState);
  validateRngState(state.aimErrorRngState);
  if (state.controllers.length === 0 || state.controllers.length > AI_MAX_CONTROLLERS) {
    throw new RangeError(`AI authority requires 1..${AI_MAX_CONTROLLERS} controllers`);
  }
  assertSortedUnique(
    state.controllers.map((controller) => controller.actorId),
    "AI controller",
  );
  for (const controller of state.controllers) assertController(controller);
  if (state.bosses.length > AI_MAX_BOSSES) {
    throw new RangeError(`AI authority cannot track more than ${AI_MAX_BOSSES} bosses`);
  }
  assertSortedUnique(
    state.bosses.map((boss) => boss.bossId),
    "boss runtime",
  );
  for (const boss of state.bosses) assertBossRuntime(boss);
  const controllerBossIds = state.controllers
    .flatMap((controller) => (controller.bossId === null ? [] : [controller.bossId]))
    .sort(compareText);
  const runtimeBossIds = state.bosses.map((boss) => boss.bossId);
  if (
    controllerBossIds.length !== runtimeBossIds.length ||
    controllerBossIds.some((bossId, index) => bossId !== runtimeBossIds[index])
  ) {
    throw new Error("AI boss controllers and boss runtime states must match");
  }
}

export function findAiController(state: AiAuthorityState, actorId: string): AiControllerState {
  const controller = state.controllers.find((candidate) => candidate.actorId === actorId);
  if (controller === undefined) throw new Error(`AI controller not found: ${actorId}`);
  return controller;
}

export function findBossRuntime(state: AiAuthorityState, bossId: BossId): BossRuntimeState {
  const runtime = state.bosses.find((candidate) => candidate.bossId === bossId);
  if (runtime === undefined) throw new Error(`boss runtime not found: ${bossId}`);
  return runtime;
}

export function replaceBossRuntime(
  state: AiAuthorityState,
  runtime: BossRuntimeState,
): AiAuthorityState {
  return {
    ...state,
    bosses: state.bosses.map((candidate) =>
      candidate.bossId === runtime.bossId ? runtime : candidate,
    ),
  };
}

function createBossRuntime(bossId: BossId): BossRuntimeState {
  const definition = getBossDefinition(bossId);
  const firstStage = definition.stages[0];
  if (firstStage === undefined) throw new Error(`boss ${bossId} has no stages`);
  return {
    bossId,
    stageIndex: 0,
    stageProgress: 0,
    completed: false,
    acceptedCommandIds: [],
    stageHistory: [firstStage.id],
  };
}

function assertController(controller: AiControllerState): void {
  assertIdentifier(controller.actorId, "AI actor id");
  const hasPrototype = controller.prototypeId !== null;
  const hasBoss = controller.bossId !== null;
  if (hasPrototype === hasBoss) {
    throw new Error("AI controller must reference exactly one enemy prototype or boss");
  }
  if (controller.prototypeId !== null && !ENEMY_PROTOTYPE_IDS.includes(controller.prototypeId)) {
    throw new Error(`unknown enemy prototype: ${controller.prototypeId}`);
  }
  if (controller.bossId !== null && !BOSS_IDS.includes(controller.bossId)) {
    throw new Error(`unknown boss: ${controller.bossId}`);
  }
  if (controller.eliteTemplateId !== null) {
    if (!ELITE_TEMPLATE_IDS.includes(controller.eliteTemplateId)) {
      throw new Error(`unknown elite template: ${controller.eliteTemplateId}`);
    }
    if (controller.prototypeId === null)
      throw new Error("boss controllers cannot use elite templates");
    if (getEliteTemplate(controller.eliteTemplateId).prototypeId !== controller.prototypeId) {
      throw new Error("elite template prototype does not match its controller");
    }
  }
}

function assertBossRuntime(runtime: BossRuntimeState): void {
  if (!BOSS_IDS.includes(runtime.bossId)) throw new Error(`unknown boss: ${runtime.bossId}`);
  const definition = getBossDefinition(runtime.bossId);
  if (
    !Number.isSafeInteger(runtime.stageIndex) ||
    runtime.stageIndex < 0 ||
    runtime.stageIndex >= definition.stages.length
  ) {
    throw new RangeError(`boss stage index is invalid: ${runtime.bossId}`);
  }
  const stage = definition.stages[runtime.stageIndex];
  if (stage === undefined) throw new Error("boss stage is missing");
  if (
    !Number.isSafeInteger(runtime.stageProgress) ||
    runtime.stageProgress < 0 ||
    runtime.stageProgress >= stage.requiredProgress
  ) {
    throw new RangeError(`boss stage progress is invalid: ${runtime.bossId}`);
  }
  if (
    runtime.completed !==
    (runtime.stageIndex === definition.stages.length - 1 &&
      runtime.stageProgress === 0 &&
      runtime.stageHistory.length === definition.stages.length + 1)
  ) {
    throw new Error(`boss completion state is inconsistent: ${runtime.bossId}`);
  }
  if (runtime.acceptedCommandIds.length > AI_MAX_BOSS_COUNTERS) {
    throw new RangeError("boss accepted counter log exceeds the supported bound");
  }
  assertUnique(runtime.acceptedCommandIds, "boss command");
  if (
    runtime.stageHistory.length === 0 ||
    runtime.stageHistory.length > definition.stages.length + 1
  ) {
    throw new Error("boss stage history is invalid");
  }
  const expectedHistory = definition.stages
    .slice(0, runtime.completed ? definition.stages.length : runtime.stageIndex + 1)
    .map((candidate) => candidate.id);
  if (runtime.completed) expectedHistory.push("complete");
  if (
    expectedHistory.length !== runtime.stageHistory.length ||
    expectedHistory.some((stageId, index) => stageId !== runtime.stageHistory[index])
  ) {
    throw new Error("boss stage history is inconsistent");
  }
}

function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER_PATTERN.test(value) || value.length > 128) {
    throw new Error(`${label} is invalid: ${value}`);
  }
}

function assertSortedUnique(values: readonly string[], label: string): void {
  const normalized = Array.from(new Set(values)).sort(compareText);
  if (
    normalized.length !== values.length ||
    normalized.some((value, index) => value !== values[index])
  ) {
    throw new Error(`${label} ids must be sorted and unique`);
  }
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} ids must be unique`);
  for (const value of values) assertIdentifier(value, `${label} id`);
}

function compareController(left: AiControllerState, right: AiControllerState): number {
  return compareText(left.actorId, right.actorId);
}

function compareBoss(left: BossRuntimeState, right: BossRuntimeState): number {
  return compareText(left.bossId, right.bossId);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
