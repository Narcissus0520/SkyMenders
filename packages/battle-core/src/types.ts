import type { BattleCommand, BattleEvent } from "@skymenders/protocol";
import type { GridPoint, TerrainState } from "@skymenders/terrain-core";

import type { ModuleId, ModuleUpgradeRouteId } from "./module-registry.js";

export const BATTLE_SCHEMA_VERSION = "0.1.0";
export const BATTLE_RULES_VERSION = "0.3.0";
export const BATTLE_MAX_ACTORS = 64;
export const BATTLE_MAX_OBJECTIVES = 3;
export const BATTLE_MAX_EFFECTS = 256;
export const BATTLE_MAX_COMMANDS = 100_000;

export type BattlePhase =
  | "player_planning"
  | "player_action"
  | "enemy_action"
  | "environment_settlement"
  | "battle_complete";

export type ActorTeam = "player" | "enemy" | "neutral";
export type StructuralFaultSource = "fall" | "overload" | "collision" | "magnetic";
export type StructuralFaultKind =
  "mobility_fault" | "cooling_fault" | "stability_fault" | "aiming_fault";

export interface StructuralFault {
  readonly kind: StructuralFaultKind;
  readonly source: StructuralFaultSource;
  readonly severity: "minor" | "major";
}

export interface ModuleRouteSelection {
  readonly moduleId: ModuleId;
  readonly routeId: ModuleUpgradeRouteId;
}

export interface ModuleCooldown {
  readonly moduleId: ModuleId;
  readonly remainingRounds: number;
}

export interface BattleActor {
  readonly id: string;
  readonly team: ActorTeam;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly structuralDamage: number;
  readonly faults: readonly StructuralFault[];
  readonly disabled: boolean;
  readonly recoveryBeaconId: string | null;
  readonly carriedObjectId: string | null;
  readonly movementUsed: boolean;
  readonly mainModuleUsed: boolean;
  readonly actionEnded: boolean;
  readonly auxiliaryUses: number;
  readonly mainModuleId: ModuleId;
  readonly auxiliaryModuleIds: readonly ModuleId[];
  readonly selectedRoutes: readonly ModuleRouteSelection[];
  readonly cooldowns: readonly ModuleCooldown[];
}

export interface BattleEnergyState {
  readonly current: number;
  readonly maximum: number;
  readonly regenerationPerRound: number;
  readonly waitGain: number;
  readonly waitEnergyGrantedThisRound: number;
  readonly maximumWaitEnergyPerRound: number;
}

export type ObjectiveRole = "primary" | "secondary" | "hidden";
export type ObjectiveStatus = "active" | "completed" | "failed";
export type ObjectiveTrigger =
  | "repair_energy_tower"
  | "deliver_energy_core"
  | "rescue_unit"
  | "hold_round"
  | "defeat_guard"
  | "preserve_island"
  | "close_pollution_node"
  | "no_robot_disabled"
  | "terrain_integrity"
  | "round_limit"
  | "module_category_avoided"
  | "extra_rescue"
  | "pollution_cleared"
  | "magnetic_collision"
  | "rescue_without_attack"
  | "hidden_pipeline_repaired"
  | "reflected_hit"
  | "relic_preserved";

export interface BattleObjective {
  readonly id: string;
  readonly role: ObjectiveRole;
  readonly trigger: ObjectiveTrigger;
  readonly progress: number;
  readonly required: number;
  readonly status: ObjectiveStatus;
  readonly criticalInteraction: boolean;
  readonly requiredModuleId: ModuleId | null;
  readonly targetId: string | null;
}

export type BattleObjectKind = "metal_object" | "task_object" | "rescue_unit" | "relic";

export interface BattleWorldObject {
  readonly id: string;
  readonly kind: BattleObjectKind;
  readonly x: number;
  readonly y: number;
  readonly mass: number;
  readonly active: boolean;
}

export type BattleFieldEffectKind =
  | "gravity_field"
  | "bubble"
  | "wind_field"
  | "energy_rail"
  | "reflector"
  | "stabilizer"
  | "route_scan"
  | "energy_recycler"
  | "temporary_foam"
  | "jammer"
  | "structure_scan"
  | "conductive_bridge";

export interface BattleFieldEffect {
  readonly id: string;
  readonly kind: BattleFieldEffectKind;
  readonly sourceActorId: string;
  readonly targetActorId: string | null;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly directionMilliDegrees: number;
  readonly magnitude: number;
  readonly remainingRounds: number;
  readonly consumed: boolean;
}

export interface BattleTemporarySupport {
  readonly effectId: string;
  readonly rootId: string;
  readonly remainingRounds: number;
}

export interface BattleTemporaryTerrain {
  readonly effectId: string;
  readonly cells: readonly GridPoint[];
  readonly remainingRounds: number;
}

export interface BattleIntelState {
  readonly routeRevealDepth: number;
  readonly trajectoryPreviewPermille: number;
  readonly hiddenTargetIds: readonly string[];
  readonly supportRiskCellIndices: readonly number[];
}

export interface BattleStatistics {
  readonly directAttacksUsed: number;
  readonly robotsDisabled: number;
  readonly extraRescues: number;
  readonly reflectedHits: number;
  readonly magneticCollisions: number;
  readonly terrainInitialIntegrity: number;
  readonly terrainIntegrityPermille: number;
}

export interface BattleOutcome {
  readonly status: "ongoing" | "victory" | "defeat";
  readonly reason: "none" | "primary_completed" | "primary_failed" | "team_disabled";
}

export interface BattleState {
  readonly battleSchemaVersion: string;
  readonly rulesVersion: string;
  readonly battleId: string;
  readonly turnIndex: number;
  readonly phase: BattlePhase;
  readonly nextEventSequence: number;
  readonly config: BattleRuleConfig;
  readonly energy: BattleEnergyState;
  readonly actors: readonly BattleActor[];
  readonly objectives: readonly BattleObjective[];
  readonly worldObjects: readonly BattleWorldObject[];
  readonly fieldEffects: readonly BattleFieldEffect[];
  readonly temporarySupports: readonly BattleTemporarySupport[];
  readonly temporaryTerrain: readonly BattleTemporaryTerrain[];
  readonly intel: BattleIntelState;
  readonly statistics: BattleStatistics;
  readonly terrain: TerrainState;
  readonly outcome: BattleOutcome;
}

export interface BattleRuleConfig {
  readonly maximumEnergy: number;
  readonly regenerationPerRound: number;
  readonly waitGain: number;
  readonly maximumWaitEnergyPerRound: number;
  readonly maximumMoveDistance: number;
  readonly maximumAuxiliaryUsesPerActor: number;
  readonly basicRepairHp: number;
  readonly basicPushDistance: number;
  readonly survivorRecoveryPermille: number;
  readonly disabledRecoveryPermille: number;
  readonly nodeStructuralRepair: number;
  readonly safeFallDistance: number;
  readonly fallHpDamagePerCell: number;
  readonly fallStructuralDamagePerCell: number;
}

export interface CreateBattleDefinition {
  readonly battleId: string;
  readonly terrain: TerrainState;
  readonly actors: readonly BattleActor[];
  readonly objectives: readonly BattleObjective[];
  readonly worldObjects?: readonly BattleWorldObject[];
  readonly initialEnergy?: number;
  readonly config?: Partial<BattleRuleConfig>;
}

export type BattleRuleEffectKind =
  | "energy_changed"
  | "actor_repaired"
  | "actor_moved"
  | "actor_damaged"
  | "structural_damage_changed"
  | "fault_changed"
  | "actor_disabled"
  | "objective_progressed"
  | "objective_completed"
  | "terrain_damaged"
  | "terrain_repaired"
  | "terrain_collapsed"
  | "field_created"
  | "field_expired"
  | "support_created"
  | "support_expired"
  | "world_object_moved"
  | "intel_revealed";

export interface BattleRuleEffect {
  readonly kind: BattleRuleEffectKind;
  readonly sourceId: string;
  readonly targetId: string | null;
  readonly targetX: number | null;
  readonly targetY: number | null;
  readonly magnitude: number;
  readonly duration: number;
  readonly details: Readonly<Record<string, string | number | boolean | null>>;
}

export interface BattleTransition {
  readonly state: BattleState;
  readonly effects: readonly BattleRuleEffect[];
}

export interface BattleCommandCheckpoint {
  readonly commandIndex: number;
  readonly stateHash: string;
}

export interface BattleCommandExecution {
  readonly finalState: BattleState;
  readonly checkpoints: readonly BattleCommandCheckpoint[];
  readonly events: readonly BattleEvent[];
}

export interface BattleProjectileState {
  readonly id: string;
  readonly sourceActorId: string;
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly power: number;
  readonly reflectionCount: number;
}

export interface BattleProjectileResolution {
  readonly state: BattleState;
  readonly projectile: BattleProjectileState;
  readonly effects: readonly BattleRuleEffect[];
}

export interface BattleValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface BattleValidationReport {
  readonly valid: boolean;
  readonly issues: readonly BattleValidationIssue[];
}

export interface BattleCommandContext {
  readonly command: BattleCommand;
  readonly commandIndex: number;
}
