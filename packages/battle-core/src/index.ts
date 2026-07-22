export {
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
} from "./module-registry.js";
export type {
  AuxiliaryModuleId,
  MainModuleId,
  ModuleClass,
  ModuleDefinition,
  ModuleId,
  ModuleLoadoutInput,
  ModuleTargetMode,
  ModuleUpgradeRouteDefinition,
  ModuleUpgradeRouteId,
} from "./module-registry.js";
export {
  applyActorDurabilityDamage,
  recoverTeamAfterNode,
  repairBattleActor,
} from "./durability.js";
export type { DurabilityDamage } from "./durability.js";
export { resolveModuleCommand } from "./modules.js";
export { applyObjectiveSignal, failObjective, updateBattleOutcome } from "./objectives.js";
export type { ObjectiveSignal } from "./objectives.js";
export { advanceBattlePhase } from "./phases.js";
export { applyBattleFieldsToProjectile, jammerTargetScoreModifier } from "./projectile.js";
export { executeBattleCommands, reduceBattleCommand } from "./reducer.js";
export type { BattleReducerResult } from "./reducer.js";
export {
  DEFAULT_BATTLE_RULE_CONFIG,
  actorCooldown,
  actorHasModule,
  assertBattleState,
  createBattleState,
  effectiveModuleCooldown,
  effectiveModuleEnergyCost,
  effectiveMoveDistance,
  findBattleActor,
  manhattanDistance,
  normalizeBattleRuleConfig,
  replaceBattleActor,
  selectedRoute,
  terrainIntegrityPermille,
  terrainTotalIntegrity,
} from "./state.js";
export { validateBattleDefinition } from "./validator.js";
export {
  BATTLE_MAX_ACTORS,
  BATTLE_MAX_COMMANDS,
  BATTLE_MAX_EFFECTS,
  BATTLE_MAX_OBJECTIVES,
  BATTLE_RULES_VERSION,
  BATTLE_SCHEMA_VERSION,
} from "./types.js";
export type {
  ActorTeam,
  BattleActor,
  BattleCommandCheckpoint,
  BattleCommandContext,
  BattleCommandExecution,
  BattleEnergyState,
  BattleFieldEffect,
  BattleFieldEffectKind,
  BattleIntelState,
  BattleObjective,
  BattleObjectKind,
  BattleOutcome,
  BattlePhase,
  BattleProjectileResolution,
  BattleProjectileState,
  BattleRuleConfig,
  BattleRuleEffect,
  BattleRuleEffectKind,
  BattleState,
  BattleStatistics,
  BattleTemporarySupport,
  BattleTemporaryTerrain,
  BattleTransition,
  BattleValidationIssue,
  BattleValidationReport,
  BattleWorldObject,
  CreateBattleDefinition,
  ModuleCooldown,
  ModuleRouteSelection,
  ObjectiveRole,
  ObjectiveStatus,
  ObjectiveTrigger,
  StructuralFault,
  StructuralFaultKind,
  StructuralFaultSource,
} from "./types.js";
