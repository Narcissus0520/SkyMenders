import { assertBattleState, validateModuleLoadout } from "@skymenders/battle-core";
import type { BattleActor, BattleState, ModuleId } from "@skymenders/battle-core";

import {
  AI_DIFFICULTY_PROFILES,
  BOSS_DEFINITIONS,
  ELITE_AFFIX_DEFINITIONS,
  ELITE_TEMPLATE_DEFINITIONS,
  ENEMY_DEFINITIONS,
  getBossDefinition,
  getEnemyDefinition,
} from "./catalog.js";
import { assertAiAuthorityState } from "./state.js";
import {
  AI_DIFFICULTIES,
  AI_UTILITY_DIMENSIONS,
  BOSS_IDS,
  ELITE_AFFIX_IDS,
  ELITE_TEMPLATE_IDS,
  ENEMY_PROTOTYPE_IDS,
} from "./types.js";
import type {
  AiAuthorityState,
  AiCatalogIssue,
  AiCatalogReport,
  BossCounterSignal,
  BossDefinition,
  EnemyDefinition,
} from "./types.js";

const LOCALIZATION_KEY_PATTERN = /^[a-z][a-z0-9_.-]+$/;

export function validateAiCatalog(): AiCatalogReport {
  const issues: AiCatalogIssue[] = [];
  validateExactKeys(ENEMY_DEFINITIONS, ENEMY_PROTOTYPE_IDS, "ENEMY_CATALOG", issues);
  validateExactKeys(ELITE_AFFIX_DEFINITIONS, ELITE_AFFIX_IDS, "ELITE_AFFIX_CATALOG", issues);
  validateExactKeys(
    ELITE_TEMPLATE_DEFINITIONS,
    ELITE_TEMPLATE_IDS,
    "ELITE_TEMPLATE_CATALOG",
    issues,
  );
  validateExactKeys(BOSS_DEFINITIONS, BOSS_IDS, "BOSS_CATALOG", issues);

  for (const prototypeId of ENEMY_PROTOTYPE_IDS) {
    validateEnemy(getEnemyDefinition(prototypeId), `enemies.${prototypeId}`, issues);
  }
  for (const affixId of ELITE_AFFIX_IDS) {
    const affix = ELITE_AFFIX_DEFINITIONS[affixId];
    validateLocalizationKey(affix.nameKey, `affixes.${affixId}.nameKey`, issues);
    validateLocalizationKey(affix.mechanicKey, `affixes.${affixId}.mechanicKey`, issues);
    for (const [dimension, adjustment] of Object.entries(affix.weightAdjustments)) {
      if (
        !AI_UTILITY_DIMENSIONS.includes(dimension as (typeof AI_UTILITY_DIMENSIONS)[number]) ||
        !Number.isSafeInteger(adjustment) ||
        Math.abs(adjustment) > 200
      ) {
        issue(
          issues,
          "ELITE_WEIGHT_INVALID",
          `affixes.${affixId}.weightAdjustments`,
          "elite weight adjustments must use known dimensions within -200..200",
        );
      }
    }
  }
  for (const templateId of ELITE_TEMPLATE_IDS) {
    const template = ELITE_TEMPLATE_DEFINITIONS[templateId];
    if (template.affixIds.length === 0 || template.affixIds.length > 2) {
      issue(
        issues,
        "ELITE_AFFIX_COUNT",
        `eliteTemplates.${templateId}`,
        "elite templates require one or two whitelisted affixes",
      );
    }
    if (new Set(template.affixIds).size !== template.affixIds.length) {
      issue(
        issues,
        "ELITE_AFFIX_DUPLICATE",
        `eliteTemplates.${templateId}`,
        "elite affixes must be distinct",
      );
    }
    if (!ENEMY_PROTOTYPE_IDS.includes(template.prototypeId)) {
      issue(
        issues,
        "ELITE_PROTOTYPE_INVALID",
        `eliteTemplates.${templateId}`,
        "elite template references an unknown prototype",
      );
    }
  }
  validateDifficulties(issues);
  for (const bossId of BOSS_IDS) validateBoss(getBossDefinition(bossId), issues);
  return report(issues);
}

export function assertAiBattleBindings(battle: BattleState, aiState: AiAuthorityState): void {
  assertBattleState(battle);
  assertAiAuthorityState(aiState);
  const enemyActors = battle.actors.filter((actor) => actor.team === "enemy");
  const enemyIds = enemyActors.map((actor) => actor.id).sort(compareText);
  const controllerIds = aiState.controllers.map((controller) => controller.actorId);
  if (
    enemyIds.length !== controllerIds.length ||
    enemyIds.some((actorId, index) => actorId !== controllerIds[index])
  ) {
    throw new Error("every enemy actor requires exactly one sorted AI controller");
  }
  for (const controller of aiState.controllers) {
    const actor = enemyActors.find((candidate) => candidate.id === controller.actorId);
    if (actor === undefined)
      throw new Error(`AI actor is absent from battle: ${controller.actorId}`);
    if (controller.prototypeId !== null) {
      assertActorLoadout(actor, getEnemyDefinition(controller.prototypeId));
    } else if (controller.bossId !== null) {
      assertActorLoadout(actor, getBossDefinition(controller.bossId));
    }
  }
}

function validateEnemy(definition: EnemyDefinition, path: string, issues: AiCatalogIssue[]): void {
  validateLocalizationKey(definition.nameKey, `${path}.nameKey`, issues);
  validateLocalizationKey(definition.roleKey, `${path}.roleKey`, issues);
  if (
    !Number.isSafeInteger(definition.baseHp) ||
    definition.baseHp <= 0 ||
    definition.baseHp > 1_000
  ) {
    issue(issues, "ENEMY_HP_INVALID", `${path}.baseHp`, "enemy base HP must be within 1..1000");
  }
  const loadoutIssues = validateModuleLoadout(definition);
  for (const message of loadoutIssues) issue(issues, "ENEMY_LOADOUT_INVALID", path, message);
  if (definition.flags.length === 0 || new Set(definition.flags).size !== definition.flags.length) {
    issue(issues, "ENEMY_FLAGS_INVALID", `${path}.flags`, "behavior flags must be distinct");
  }
  if (
    definition.preferredGoals.length === 0 ||
    new Set(definition.preferredGoals).size !== definition.preferredGoals.length
  ) {
    issue(
      issues,
      "ENEMY_GOALS_INVALID",
      `${path}.preferredGoals`,
      "preferred goals must be non-empty and distinct",
    );
  }
  validateWeights(definition.utilityWeights, `${path}.utilityWeights`, issues);
}

function validateDifficulties(issues: AiCatalogIssue[]): void {
  const profiles = AI_DIFFICULTIES.map((difficulty) => AI_DIFFICULTY_PROFILES[difficulty]);
  for (const profile of profiles) {
    for (const value of [
      profile.maximumMoveCandidates,
      profile.maximumTargetCandidatesPerModule,
      profile.maximumCandidates,
      profile.angleErrorMilliDegrees,
      profile.powerErrorPermille,
      profile.objectiveAwarenessPermille,
      profile.hazardAwarenessPermille,
    ]) {
      if (!Number.isSafeInteger(value) || value < 0) {
        issue(
          issues,
          "DIFFICULTY_VALUE_INVALID",
          `difficulties.${profile.id}`,
          "difficulty values must be non-negative safe integers",
        );
      }
    }
    if (
      profile.maximumCandidates <= 0 ||
      profile.objectiveAwarenessPermille > 1_000 ||
      profile.hazardAwarenessPermille > 1_000
    ) {
      issue(
        issues,
        "DIFFICULTY_BOUND_INVALID",
        `difficulties.${profile.id}`,
        "difficulty search and awareness values exceed supported bounds",
      );
    }
  }
  for (let index = 1; index < profiles.length; index += 1) {
    const easier = profiles[index - 1];
    const harder = profiles[index];
    if (
      easier === undefined ||
      harder === undefined ||
      harder.maximumCandidates <= easier.maximumCandidates ||
      harder.angleErrorMilliDegrees >= easier.angleErrorMilliDegrees ||
      harder.powerErrorPermille >= easier.powerErrorPermille ||
      harder.objectiveAwarenessPermille < easier.objectiveAwarenessPermille ||
      harder.hazardAwarenessPermille < easier.hazardAwarenessPermille
    ) {
      issue(
        issues,
        "DIFFICULTY_PROGRESSION_INVALID",
        "difficulties",
        "difficulty must improve search, aim, objective awareness, and hazard awareness",
      );
    }
  }
}

function validateBoss(definition: BossDefinition, issues: AiCatalogIssue[]): void {
  const path = `bosses.${definition.id}`;
  validateLocalizationKey(definition.nameKey, `${path}.nameKey`, issues);
  const loadoutIssues = validateModuleLoadout(definition);
  for (const message of loadoutIssues) issue(issues, "BOSS_LOADOUT_INVALID", path, message);
  validateWeights(definition.utilityWeights, `${path}.utilityWeights`, issues);
  if (definition.stages.length !== 3) {
    issue(
      issues,
      "BOSS_STAGE_COUNT",
      `${path}.stages`,
      "launch bosses require exactly three stages",
    );
  }
  const stageIds = new Set<string>();
  const equipped = new Set<ModuleId>([definition.mainModuleId, ...definition.auxiliaryModuleIds]);
  for (const [index, stage] of definition.stages.entries()) {
    if (stageIds.has(stage.id)) {
      issue(
        issues,
        "BOSS_STAGE_DUPLICATE",
        `${path}.stages[${index}]`,
        "boss stage IDs must be unique",
      );
    }
    stageIds.add(stage.id);
    validateLocalizationKey(stage.nameKey, `${path}.stages[${index}].nameKey`, issues);
    validateLocalizationKey(stage.mechanicKey, `${path}.stages[${index}].mechanicKey`, issues);
    validateLocalizationKey(stage.cueKey, `${path}.stages[${index}].cueKey`, issues);
    if (stage.counters[0] === stage.counters[1]) {
      issue(
        issues,
        "BOSS_COUNTER_DUPLICATE",
        `${path}.stages[${index}].counters`,
        "each boss stage requires two distinct counter strategies",
      );
    }
    if (!Number.isSafeInteger(stage.requiredProgress) || stage.requiredProgress <= 0) {
      issue(
        issues,
        "BOSS_PROGRESS_INVALID",
        `${path}.stages[${index}].requiredProgress`,
        "boss stage progress must be positive",
      );
    }
    if (stage.preferredModules.some((moduleId) => !equipped.has(moduleId))) {
      issue(
        issues,
        "BOSS_STAGE_MODULE_UNEQUIPPED",
        `${path}.stages[${index}].preferredModules`,
        "boss stages may only prefer equipped modules",
      );
    }
  }
  const [firstRoute, secondRoute] = definition.solutionRoutes;
  if (firstRoute.join(":") === secondRoute.join(":")) {
    issue(
      issues,
      "BOSS_ROUTES_DUPLICATE",
      `${path}.solutionRoutes`,
      "boss solution routes must differ",
    );
  }
  for (const [routeIndex, route] of definition.solutionRoutes.entries()) {
    if (!simulatesBossCompletion(definition, route)) {
      issue(
        issues,
        "BOSS_ROUTE_INCOMPLETE",
        `${path}.solutionRoutes[${routeIndex}]`,
        "declared boss solution does not complete all stages",
      );
    }
  }
}

function simulatesBossCompletion(
  definition: BossDefinition,
  signals: readonly BossCounterSignal[],
): boolean {
  let stageIndex = 0;
  let progress = 0;
  for (const signal of signals) {
    const stage = definition.stages[stageIndex];
    if (stage?.counters.includes(signal) !== true) return false;
    progress += 1;
    if (progress >= stage.requiredProgress) {
      stageIndex += 1;
      progress = 0;
    }
  }
  return stageIndex === definition.stages.length && progress === 0;
}

function assertActorLoadout(
  actor: BattleActor,
  definition: Pick<
    EnemyDefinition | BossDefinition,
    "mainModuleId" | "auxiliaryModuleIds" | "selectedRoutes"
  >,
): void {
  const actualRoutes = [...actor.selectedRoutes].sort((left, right) =>
    compareText(left.moduleId, right.moduleId),
  );
  const expectedRoutes = [...definition.selectedRoutes].sort((left, right) =>
    compareText(left.moduleId, right.moduleId),
  );
  if (
    actor.mainModuleId !== definition.mainModuleId ||
    actor.auxiliaryModuleIds.length !== definition.auxiliaryModuleIds.length ||
    actor.auxiliaryModuleIds.some(
      (moduleId, index) => moduleId !== definition.auxiliaryModuleIds[index],
    ) ||
    actualRoutes.length !== expectedRoutes.length ||
    actualRoutes.some((selection, index) => {
      const expected = expectedRoutes.at(index);
      return selection.moduleId !== expected?.moduleId || selection.routeId !== expected.routeId;
    })
  ) {
    throw new Error(`AI actor loadout does not match catalog: ${actor.id}`);
  }
}

function validateWeights(
  weights: EnemyDefinition["utilityWeights"],
  path: string,
  issues: AiCatalogIssue[],
): void {
  for (const dimension of AI_UTILITY_DIMENSIONS) {
    const weight = weights[dimension];
    if (!Number.isSafeInteger(weight) || weight < 0 || weight > 500) {
      issue(
        issues,
        "UTILITY_WEIGHT_INVALID",
        `${path}.${dimension}`,
        "utility weights must be integers within 0..500",
      );
    }
  }
}

function validateLocalizationKey(value: string, path: string, issues: AiCatalogIssue[]): void {
  if (!LOCALIZATION_KEY_PATTERN.test(value)) {
    issue(issues, "LOCALIZATION_KEY_INVALID", path, `invalid localization key ${value}`);
  }
}

function validateExactKeys<T extends string>(
  catalog: Readonly<Record<T, unknown>>,
  expected: readonly T[],
  code: string,
  issues: AiCatalogIssue[],
): void {
  const actual = Object.keys(catalog).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  if (
    actual.length !== sortedExpected.length ||
    actual.some((value, index) => value !== sortedExpected[index])
  ) {
    issue(issues, code, "catalog", "catalog keys do not match the mandatory launch IDs");
  }
}

function issue(issues: AiCatalogIssue[], code: string, path: string, message: string): void {
  issues.push({ code, path, message });
}

function report(issues: AiCatalogIssue[]): AiCatalogReport {
  issues.sort(
    (left, right) =>
      compareText(left.code, right.code) ||
      compareText(left.path, right.path) ||
      compareText(left.message, right.message),
  );
  return { valid: issues.length === 0, issues };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
