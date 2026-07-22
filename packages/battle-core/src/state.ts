import { assertTerrainState, isTerrainPointInBounds, terrainIndex } from "@skymenders/terrain-core";

import {
  getModuleDefinition,
  isModuleId,
  isModuleUpgradeRouteId,
  isRouteForModule,
  validateModuleLoadout,
} from "./module-registry.js";
import type { ModuleId, ModuleUpgradeRouteId } from "./module-registry.js";
import {
  BATTLE_MAX_ACTORS,
  BATTLE_MAX_EFFECTS,
  BATTLE_MAX_OBJECTIVES,
  BATTLE_RULES_VERSION,
  BATTLE_SCHEMA_VERSION,
} from "./types.js";
import type {
  ActorTeam,
  BattleActor,
  BattleEnergyState,
  BattleObjective,
  BattleRuleConfig,
  BattleState,
  BattleWorldObject,
  CreateBattleDefinition,
  ModuleRouteSelection,
} from "./types.js";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const MAXIMUM_BATTLE_ENERGY = 1_000;
const MAXIMUM_MOVE_DISTANCE = 1_024;
const MAXIMUM_FALL_DISTANCE = 32_768;
const MAXIMUM_DAMAGE_PER_CELL = 1_000;

export const DEFAULT_BATTLE_RULE_CONFIG: BattleRuleConfig = Object.freeze({
  maximumEnergy: 12,
  regenerationPerRound: 6,
  waitGain: 1,
  maximumWaitEnergyPerRound: 2,
  maximumMoveDistance: 5,
  maximumAuxiliaryUsesPerActor: 2,
  basicRepairHp: 5,
  basicPushDistance: 1,
  survivorRecoveryPermille: 150,
  disabledRecoveryPermille: 350,
  nodeStructuralRepair: 10,
  safeFallDistance: 2,
  fallHpDamagePerCell: 5,
  fallStructuralDamagePerCell: 5,
});

export function createBattleState(definition: CreateBattleDefinition): BattleState {
  const config = normalizeBattleRuleConfig(definition.config);
  const terrainInitialIntegrity = terrainTotalIntegrity(definition.terrain);
  const state: BattleState = {
    battleSchemaVersion: BATTLE_SCHEMA_VERSION,
    rulesVersion: BATTLE_RULES_VERSION,
    battleId: definition.battleId,
    turnIndex: 0,
    phase: "player_planning",
    nextEventSequence: 0,
    config,
    energy: createEnergyState(definition.initialEnergy ?? config.maximumEnergy, config),
    enemyEnergy: createEnergyState(definition.initialEnemyEnergy ?? config.maximumEnergy, config),
    actors: definition.actors.map(normalizeActor).sort(compareById),
    objectives: definition.objectives.map(normalizeObjective).sort(compareById),
    worldObjects: [...(definition.worldObjects ?? [])].sort(compareById),
    fieldEffects: [],
    temporarySupports: [],
    temporaryTerrain: [],
    intel: {
      routeRevealDepth: 1,
      trajectoryPreviewPermille: 500,
      hiddenTargetIds: [],
      supportRiskCellIndices: [],
    },
    statistics: {
      directAttacksUsed: 0,
      robotsDisabled: 0,
      extraRescues: 0,
      reflectedHits: 0,
      magneticCollisions: 0,
      terrainInitialIntegrity,
      terrainIntegrityPermille: terrainIntegrityPermille(
        definition.terrain,
        terrainInitialIntegrity,
      ),
    },
    terrain: definition.terrain,
    outcome: { status: "ongoing", reason: "none" },
  };
  assertBattleState(state);
  return state;
}

export function assertBattleState(state: BattleState): void {
  if (state.battleSchemaVersion !== BATTLE_SCHEMA_VERSION) {
    throw new Error(`unsupported battle schema: ${state.battleSchemaVersion}`);
  }
  if (state.rulesVersion !== BATTLE_RULES_VERSION) {
    throw new Error(`unsupported battle rules: ${state.rulesVersion}`);
  }
  assertIdentifier(state.battleId, "battle id");
  assertNonNegativeInteger(state.turnIndex, "turn index");
  assertNonNegativeInteger(state.nextEventSequence, "event sequence");
  assertTerrainState(state.terrain);
  normalizeBattleRuleConfig(state.config);
  assertEnergy(state.energy, state.config, "player energy");
  assertEnergy(state.enemyEnergy, state.config, "enemy energy");
  if (state.actors.length === 0 || state.actors.length > BATTLE_MAX_ACTORS) {
    throw new RangeError(`battle must contain between 1 and ${BATTLE_MAX_ACTORS} actors`);
  }
  if (state.actors.filter((actor) => actor.team === "player").length !== 3) {
    throw new Error("battle must contain exactly three player robots");
  }
  assertUniqueIds(state.actors, "actor");
  for (const actor of state.actors) assertActor(state, actor);

  if (state.objectives.length === 0 || state.objectives.length > BATTLE_MAX_OBJECTIVES) {
    throw new RangeError(`battle must contain between 1 and ${BATTLE_MAX_OBJECTIVES} objectives`);
  }
  assertUniqueIds(state.objectives, "objective");
  const roles = new Set(state.objectives.map((objective) => objective.role));
  if (roles.size !== state.objectives.length || !roles.has("primary")) {
    throw new Error("battle objectives require one primary and at most one objective per role");
  }
  for (const objective of state.objectives) assertObjective(objective);

  assertUniqueIds(state.worldObjects, "world object");
  for (const object of state.worldObjects) assertWorldObject(state, object);
  assertActiveEntityOccupancy(state);
  if (state.fieldEffects.length > BATTLE_MAX_EFFECTS) {
    throw new RangeError(`battle cannot contain more than ${BATTLE_MAX_EFFECTS} field effects`);
  }
  assertUniqueIds(state.fieldEffects, "field effect");
  for (const effect of state.fieldEffects) {
    assertIdentifier(effect.sourceActorId, "effect source actor id");
    if (effect.targetActorId !== null)
      assertIdentifier(effect.targetActorId, "effect target actor id");
    assertPoint(state, effect.x, effect.y, "field effect");
    assertNonNegativeInteger(effect.radius, "field effect radius");
    assertNonNegativeInteger(effect.directionMilliDegrees, "field effect direction");
    if (effect.directionMilliDegrees > 359_999) throw new RangeError("field direction is invalid");
    assertNonNegativeInteger(effect.magnitude, "field effect magnitude");
    assertNonNegativeInteger(effect.remainingRounds, "field effect remaining rounds");
  }
  assertUniqueIds(state.temporarySupports, "temporary support root", "rootId");
  for (const support of state.temporarySupports) {
    assertIdentifier(support.effectId, "temporary support effect id");
    assertNonNegativeInteger(support.remainingRounds, "temporary support duration");
  }
  assertUniqueIds(state.temporaryTerrain, "temporary terrain", "effectId");
  for (const temporary of state.temporaryTerrain) {
    assertNonNegativeInteger(temporary.remainingRounds, "temporary terrain duration");
    if (temporary.cells.length === 0) throw new Error("temporary terrain must track cells");
    const cells = new Set<string>();
    for (const cell of temporary.cells) {
      assertPoint(state, cell.x, cell.y, "temporary terrain cell");
      const key = `${cell.x}:${cell.y}`;
      if (cells.has(key)) throw new Error("temporary terrain cells must be unique");
      cells.add(key);
    }
  }
  assertSortedUniqueStrings(state.intel.hiddenTargetIds, "hidden target ids");
  assertSortedUniqueIntegers(state.intel.supportRiskCellIndices, "support risk cells");
  assertNonNegativeInteger(state.intel.routeRevealDepth, "route reveal depth");
  assertNonNegativeInteger(state.intel.trajectoryPreviewPermille, "trajectory preview");
  if (state.intel.trajectoryPreviewPermille > 1_000) {
    throw new RangeError("trajectory preview must not exceed 1000 permille");
  }
  for (const value of [
    state.statistics.directAttacksUsed,
    state.statistics.robotsDisabled,
    state.statistics.extraRescues,
    state.statistics.reflectedHits,
    state.statistics.magneticCollisions,
    state.statistics.terrainInitialIntegrity,
    state.statistics.terrainIntegrityPermille,
  ]) {
    assertNonNegativeInteger(value, "battle statistic");
  }
  if (state.statistics.terrainIntegrityPermille > 1_000) {
    throw new RangeError("terrain integrity statistic cannot exceed 1000");
  }
  if ((state.outcome.status === "ongoing") === (state.phase === "battle_complete")) {
    throw new Error("battle outcome and phase are inconsistent");
  }
  if (
    (state.outcome.status === "ongoing" && state.outcome.reason !== "none") ||
    (state.outcome.status !== "ongoing" && state.outcome.reason === "none") ||
    (state.outcome.status === "victory" && state.outcome.reason !== "primary_completed") ||
    (state.outcome.status === "defeat" &&
      state.outcome.reason !== "primary_failed" &&
      state.outcome.reason !== "team_disabled")
  ) {
    throw new Error("battle outcome reason is inconsistent");
  }
}

export function normalizeBattleRuleConfig(
  overrides: Partial<BattleRuleConfig> = {},
): BattleRuleConfig {
  const config = { ...DEFAULT_BATTLE_RULE_CONFIG, ...overrides };
  for (const [key, value] of Object.entries(config)) {
    assertNonNegativeInteger(value, `battle config ${key}`);
  }
  if (config.maximumEnergy <= 0 || config.regenerationPerRound > config.maximumEnergy) {
    throw new RangeError("energy maximum must be positive and cover per-round regeneration");
  }
  if (config.maximumMoveDistance <= 0 || config.maximumAuxiliaryUsesPerActor > 2) {
    throw new RangeError("movement must be positive and auxiliary uses cannot exceed two");
  }
  if (config.survivorRecoveryPermille > 1_000 || config.disabledRecoveryPermille > 1_000) {
    throw new RangeError("node recovery ratios cannot exceed 1000 permille");
  }
  if (
    config.maximumEnergy > MAXIMUM_BATTLE_ENERGY ||
    config.waitGain > MAXIMUM_BATTLE_ENERGY ||
    config.maximumWaitEnergyPerRound > MAXIMUM_BATTLE_ENERGY ||
    config.maximumMoveDistance > MAXIMUM_MOVE_DISTANCE ||
    config.basicRepairHp > 1_000 ||
    config.basicPushDistance > 64 ||
    config.nodeStructuralRepair > 100 ||
    config.safeFallDistance > MAXIMUM_FALL_DISTANCE ||
    config.fallHpDamagePerCell > MAXIMUM_DAMAGE_PER_CELL ||
    config.fallStructuralDamagePerCell > MAXIMUM_DAMAGE_PER_CELL
  ) {
    throw new RangeError("battle configuration exceeds deterministic safety bounds");
  }
  return Object.freeze(config);
}

export function findBattleActor(state: BattleState, actorId: string): BattleActor {
  const actor = state.actors.find((candidate) => candidate.id === actorId);
  if (actor === undefined) throw new Error(`battle actor not found: ${actorId}`);
  return actor;
}

export function replaceBattleActor(state: BattleState, actor: BattleActor): BattleState {
  return {
    ...state,
    actors: state.actors.map((candidate) => (candidate.id === actor.id ? actor : candidate)),
  };
}

export function actorTeamEnergy(state: BattleState, team: ActorTeam): BattleEnergyState {
  if (team === "player") return state.energy;
  if (team === "enemy") return state.enemyEnergy;
  throw new Error("neutral actors do not own a battle energy pool");
}

export function replaceActorTeamEnergy(
  state: BattleState,
  team: ActorTeam,
  energy: BattleEnergyState,
): BattleState {
  if (team === "player") return { ...state, energy };
  if (team === "enemy") return { ...state, enemyEnergy: energy };
  throw new Error("neutral actors do not own a battle energy pool");
}

export function selectedRoute(actor: BattleActor, moduleId: ModuleId): ModuleUpgradeRouteId | null {
  return actor.selectedRoutes.find((selection) => selection.moduleId === moduleId)?.routeId ?? null;
}

export function actorHasModule(actor: BattleActor, moduleId: ModuleId): boolean {
  return actor.mainModuleId === moduleId || actor.auxiliaryModuleIds.includes(moduleId);
}

export function actorCooldown(actor: BattleActor, moduleId: ModuleId): number {
  return actor.cooldowns.find((cooldown) => cooldown.moduleId === moduleId)?.remainingRounds ?? 0;
}

export function effectiveMoveDistance(actor: BattleActor, config: BattleRuleConfig): number {
  const penalty = actor.faults.some((fault) => fault.kind === "mobility_fault") ? 2 : 0;
  return Math.max(1, config.maximumMoveDistance - penalty);
}

export function effectiveModuleEnergyCost(actor: BattleActor, moduleId: ModuleId): number {
  const definition = getModuleDefinition(moduleId);
  const faultPenalty = actor.faults.some((fault) => fault.kind === "cooling_fault") ? 1 : 0;
  const route = selectedRoute(actor, moduleId);
  const routeDelta =
    route === "magnetic_anchor_heavy_pull" || route === "energy_recycler_overclock" ? 1 : 0;
  return definition.energyCost + faultPenalty + routeDelta;
}

export function effectiveModuleCooldown(actor: BattleActor, moduleId: ModuleId): number {
  const definition = getModuleDefinition(moduleId);
  const faultPenalty = actor.faults.some((fault) => fault.kind === "cooling_fault") ? 1 : 0;
  const routePenalty = selectedRoute(actor, moduleId) === "drill_bee_deep_bore" ? 1 : 0;
  return definition.cooldownRounds + faultPenalty + routePenalty;
}

export function manhattanDistance(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

export function terrainTotalIntegrity(terrain: BattleState["terrain"]): number {
  let current = 0;
  for (let index = 0; index < terrain.integrities.length; index += 1) {
    const integrity = terrain.integrities[index] ?? 0;
    if ((terrain.materials[index] ?? 0) !== 0) {
      current += integrity;
    }
  }
  return current;
}

export function terrainIntegrityPermille(
  terrain: BattleState["terrain"],
  initialIntegrity = terrainTotalIntegrity(terrain),
): number {
  if (initialIntegrity === 0) return 0;
  return Math.min(1_000, Math.trunc((terrainTotalIntegrity(terrain) * 1_000) / initialIntegrity));
}

function normalizeActor(actor: BattleActor): BattleActor {
  return {
    ...actor,
    faults: [...actor.faults].sort(compareByKind),
    auxiliaryModuleIds: [...actor.auxiliaryModuleIds],
    selectedRoutes: [...actor.selectedRoutes].sort(compareRouteSelections),
    cooldowns: [...actor.cooldowns].sort(compareByModuleId),
  };
}

function normalizeObjective(objective: BattleObjective): BattleObjective {
  const progress = Math.min(objective.progress, objective.required);
  return {
    ...objective,
    progress,
    status: progress >= objective.required ? "completed" : objective.status,
  };
}

function createEnergyState(current: number, config: BattleRuleConfig): BattleEnergyState {
  return {
    current,
    maximum: config.maximumEnergy,
    regenerationPerRound: config.regenerationPerRound,
    waitGain: config.waitGain,
    waitEnergyGrantedThisRound: 0,
    maximumWaitEnergyPerRound: config.maximumWaitEnergyPerRound,
  };
}

function assertEnergy(energy: BattleEnergyState, config: BattleRuleConfig, label: string): void {
  for (const value of [
    energy.current,
    energy.maximum,
    energy.regenerationPerRound,
    energy.waitGain,
    energy.waitEnergyGrantedThisRound,
    energy.maximumWaitEnergyPerRound,
  ]) {
    assertNonNegativeInteger(value, label);
  }
  if (
    energy.maximum <= 0 ||
    energy.current > energy.maximum ||
    energy.regenerationPerRound > energy.maximum ||
    energy.waitEnergyGrantedThisRound > energy.maximumWaitEnergyPerRound
  ) {
    throw new RangeError("battle energy is outside configured bounds");
  }
  if (
    energy.maximum !== config.maximumEnergy ||
    energy.regenerationPerRound !== config.regenerationPerRound ||
    energy.waitGain !== config.waitGain ||
    energy.maximumWaitEnergyPerRound !== config.maximumWaitEnergyPerRound
  ) {
    throw new Error("battle energy does not match rule configuration");
  }
}

function assertActor(state: BattleState, actor: BattleActor): void {
  assertIdentifier(actor.id, "actor id");
  assertPoint(state, actor.x, actor.y, "actor");
  assertNonNegativeInteger(actor.hp, "actor hp");
  assertNonNegativeInteger(actor.maxHp, "actor max hp");
  assertNonNegativeInteger(actor.structuralDamage, "actor structural damage");
  if (actor.maxHp <= 0 || actor.hp > actor.maxHp || actor.structuralDamage > 100) {
    throw new RangeError(`actor durability is invalid: ${actor.id}`);
  }
  if (actor.disabled !== (actor.hp === 0)) {
    throw new Error(`actor disabled state must agree with hp: ${actor.id}`);
  }
  if (actor.disabled !== (actor.recoveryBeaconId !== null)) {
    throw new Error(`disabled actor recovery beacon is invalid: ${actor.id}`);
  }
  if (actor.recoveryBeaconId !== null) assertIdentifier(actor.recoveryBeaconId, "beacon id");
  if (actor.carriedObjectId !== null) assertIdentifier(actor.carriedObjectId, "carried object id");
  if (
    actor.faults.length > 2 ||
    new Set(actor.faults.map((fault) => fault.kind)).size !== actor.faults.length
  ) {
    throw new Error(`actor cannot have more than two distinct structural faults: ${actor.id}`);
  }
  if (actor.structuralDamage < 30 && actor.faults.length > 0) {
    throw new Error(`healthy actor cannot retain structural faults: ${actor.id}`);
  }
  if (actor.structuralDamage >= 30 && actor.faults.length === 0) {
    throw new Error(`damaged actor requires a structural fault: ${actor.id}`);
  }
  const expectedFaultSeverity = actor.structuralDamage >= 60 ? "major" : "minor";
  for (const fault of actor.faults) {
    if (
      fault.kind !== faultKindForSource(fault.source) ||
      fault.severity !== expectedFaultSeverity
    ) {
      throw new Error(`actor structural fault is inconsistent: ${actor.id}`);
    }
  }
  assertNonNegativeInteger(actor.auxiliaryUses, "actor auxiliary use count");
  if (actor.auxiliaryUses > state.config.maximumAuxiliaryUsesPerActor) {
    throw new RangeError("actor auxiliary use count exceeds the configured limit");
  }
  const loadoutErrors = validateModuleLoadout(actor);
  if (loadoutErrors.length > 0) throw new Error(`${actor.id}: ${loadoutErrors.join("; ")}`);
  const cooldownModules = new Set<ModuleId>();
  for (const cooldown of actor.cooldowns) {
    if (!isModuleId(cooldown.moduleId) || cooldownModules.has(cooldown.moduleId)) {
      throw new Error(`invalid or duplicate actor cooldown: ${actor.id}`);
    }
    cooldownModules.add(cooldown.moduleId);
    assertNonNegativeInteger(cooldown.remainingRounds, "module cooldown");
  }
  for (const routeSelection of actor.selectedRoutes) assertRouteSelection(routeSelection);
}

function assertRouteSelection(selection: ModuleRouteSelection): void {
  if (
    !isModuleId(selection.moduleId) ||
    !isModuleUpgradeRouteId(selection.routeId) ||
    !isRouteForModule(selection.moduleId, selection.routeId)
  ) {
    throw new Error("invalid module upgrade route selection");
  }
}

function assertObjective(objective: BattleObjective): void {
  assertIdentifier(objective.id, "objective id");
  assertNonNegativeInteger(objective.progress, "objective progress");
  if (!Number.isSafeInteger(objective.required) || objective.required <= 0) {
    throw new RangeError("objective required progress must be positive");
  }
  if (objective.progress > objective.required)
    throw new RangeError("objective progress exceeds required");
  if ((objective.status === "completed") !== (objective.progress === objective.required)) {
    throw new Error(`objective completion state is inconsistent: ${objective.id}`);
  }
  if (objective.requiredModuleId !== null && !isModuleId(objective.requiredModuleId)) {
    throw new Error(`objective required module is invalid: ${objective.id}`);
  }
  if (objective.targetId !== null) assertIdentifier(objective.targetId, "objective target id");
}

function assertWorldObject(state: BattleState, object: BattleWorldObject): void {
  assertIdentifier(object.id, "world object id");
  assertPoint(state, object.x, object.y, "world object");
  if (!Number.isSafeInteger(object.mass) || object.mass <= 0 || object.mass > 1_000) {
    throw new RangeError(`world object mass is invalid: ${object.id}`);
  }
}

function assertActiveEntityOccupancy(state: BattleState): void {
  const occupied = new Set<string>();
  for (const actor of state.actors) {
    if (actor.disabled) continue;
    assertOpenEntityCell(state, actor.id, actor.x, actor.y, occupied);
  }
  for (const object of state.worldObjects) {
    if (!object.active) continue;
    assertOpenEntityCell(state, object.id, object.x, object.y, occupied);
  }
}

function assertOpenEntityCell(
  state: BattleState,
  entityId: string,
  x: number,
  y: number,
  occupied: Set<string>,
): void {
  if ((state.terrain.materials[terrainIndex(state.terrain.width, x, y)] ?? 0) !== 0) {
    throw new Error(`active entity overlaps terrain: ${entityId}`);
  }
  const key = `${x}:${y}`;
  if (occupied.has(key)) throw new Error(`active entities overlap at ${key}`);
  occupied.add(key);
}

function assertPoint(state: BattleState, x: number, y: number, label: string): void {
  if (!isTerrainPointInBounds(state.terrain, x, y)) {
    throw new RangeError(`${label} position must be inside terrain bounds`);
  }
}

function faultKindForSource(source: BattleActor["faults"][number]["source"]): string {
  switch (source) {
    case "fall":
      return "mobility_fault";
    case "overload":
      return "cooling_fault";
    case "collision":
      return "stability_fault";
    case "magnetic":
      return "aiming_fault";
  }
}

function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER_PATTERN.test(value) || value.length > 128) {
    throw new Error(`${label} is invalid: ${value}`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`${label} must be non-negative`);
}

function assertUniqueIds<T extends object>(
  values: readonly T[],
  label: string,
  field: keyof T = "id" as keyof T,
): void {
  const ids = new Set<unknown>();
  for (const value of values) {
    const id = value[field];
    if (typeof id !== "string" || ids.has(id)) throw new Error(`${label} ids must be unique`);
    assertIdentifier(id, `${label} id`);
    ids.add(id);
  }
}

function assertSortedUniqueStrings(values: readonly string[], label: string): void {
  const sorted = [...new Set(values)].sort(compareText);
  if (sorted.length !== values.length || sorted.some((value, index) => value !== values[index])) {
    throw new Error(`${label} must be sorted and unique`);
  }
}

function assertSortedUniqueIntegers(values: readonly number[], label: string): void {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (
      value === undefined ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      (index > 0 && value <= (values[index - 1] ?? -1))
    ) {
      throw new Error(`${label} must be sorted unique non-negative integers`);
    }
  }
}

function compareById(left: { readonly id: string }, right: { readonly id: string }): number {
  return compareText(left.id, right.id);
}

function compareByKind(left: { readonly kind: string }, right: { readonly kind: string }): number {
  return compareText(left.kind, right.kind);
}

function compareRouteSelections(left: ModuleRouteSelection, right: ModuleRouteSelection): number {
  return compareText(left.moduleId, right.moduleId);
}

function compareByModuleId(
  left: { readonly moduleId: string },
  right: { readonly moduleId: string },
): number {
  return compareText(left.moduleId, right.moduleId);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
