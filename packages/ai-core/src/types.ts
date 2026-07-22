import type {
  BattleActor,
  BattleState,
  ModuleId,
  ModuleRouteSelection,
} from "@skymenders/battle-core";
import type { RngState } from "@skymenders/deterministic-runtime";
import type { BattleCommand, BattleEvent } from "@skymenders/protocol";

export const AI_SCHEMA_VERSION = "0.1.0";
export const AI_RULES_VERSION = "0.4.0";
export const AI_MAX_CONTROLLERS = 61;
export const AI_MAX_BOSSES = 4;
export const AI_MAX_DECISIONS = 100_000;
export const AI_MAX_CANDIDATES = 512;
export const AI_MAX_BOSS_COUNTERS = 256;

export const AI_DIFFICULTIES = ["normal", "hard", "expert"] as const;
export type AiDifficulty = (typeof AI_DIFFICULTIES)[number];

export const AI_GOALS = [
  "recover",
  "secure_objective",
  "disrupt_support",
  "control_field",
  "pressure_target",
  "reposition",
  "wait",
] as const;
export type AiGoal = (typeof AI_GOALS)[number];

export const AI_UTILITY_DIMENSIONS = [
  "taskBenefit",
  "expectedDamage",
  "terrainBenefit",
  "selfSafety",
  "controlBenefit",
  "energyCost",
  "friendlyFireRisk",
  "fallRisk",
  "exposureRisk",
] as const;
export type AiUtilityDimension = (typeof AI_UTILITY_DIMENSIONS)[number];
export type AiUtilityVector = Readonly<Record<AiUtilityDimension, number>>;
export type AiUtilityWeights = Readonly<Record<AiUtilityDimension, number>>;

export const ENEMY_PROTOTYPE_IDS = [
  "enemy_scout",
  "enemy_guard",
  "enemy_artillery",
  "enemy_driller",
  "enemy_magnet",
  "enemy_repairer",
  "enemy_wind",
  "enemy_carrier",
] as const;
export type EnemyPrototypeId = (typeof ENEMY_PROTOTYPE_IDS)[number];

export const ELITE_AFFIX_IDS = [
  "stable_core",
  "reflective_shell",
  "overdrive_circuit",
  "coordinated_protocol",
  "emergency_patch",
  "hover_chassis",
] as const;
export type EliteAffixId = (typeof ELITE_AFFIX_IDS)[number];

export const ELITE_TEMPLATE_IDS = [
  "elite_stable_scout",
  "elite_reflect_guard",
  "elite_overdrive_artillery",
  "elite_coord_driller",
  "elite_emergency_repairer",
  "elite_hover_carrier",
  "elite_tempest_pair",
  "elite_bastion_pair",
] as const;
export type EliteTemplateId = (typeof ELITE_TEMPLATE_IDS)[number];

export const BOSS_IDS = [
  "boss_rift_drill",
  "boss_polar_magnetic_tower",
  "boss_inverted_controller",
  "boss_unbound_island_mainframe",
] as const;
export type BossId = (typeof BOSS_IDS)[number];

export const BOSS_COUNTER_SIGNALS = [
  "terrain_breached",
  "support_restored",
  "energy_routed",
  "magnetic_redirected",
  "gravity_redirected",
  "core_repaired",
  "control_disrupted",
  "rescue_secured",
] as const;
export type BossCounterSignal = (typeof BOSS_COUNTER_SIGNALS)[number];

export type AiBehaviorFlag =
  | "repair_capable"
  | "objective_carrier"
  | "support_disruptor"
  | "field_controller"
  | "protector"
  | "long_range";

export type BehaviorConditionId =
  | "self_critical"
  | "ally_needs_repair"
  | "objective_available"
  | "profile_disrupts_support"
  | "profile_controls_fields"
  | "hostile_available"
  | "movement_available"
  | "always";

export type BehaviorTreeNode =
  | {
      readonly id: string;
      readonly kind: "selector" | "sequence";
      readonly children: readonly BehaviorTreeNode[];
    }
  | { readonly id: string; readonly kind: "condition"; readonly condition: BehaviorConditionId }
  | { readonly id: string; readonly kind: "goal"; readonly goal: AiGoal };

export interface BehaviorTraceEntry {
  readonly nodeId: string;
  readonly kind: BehaviorTreeNode["kind"];
  readonly status: "success" | "failure";
}

export interface AiBehaviorEvaluation {
  readonly goal: AiGoal;
  readonly trace: readonly BehaviorTraceEntry[];
}

export interface EnemyDefinition {
  readonly id: EnemyPrototypeId;
  readonly nameKey: string;
  readonly roleKey: string;
  readonly baseHp: number;
  readonly mainModuleId: ModuleId;
  readonly auxiliaryModuleIds: readonly ModuleId[];
  readonly selectedRoutes: readonly ModuleRouteSelection[];
  readonly flags: readonly AiBehaviorFlag[];
  readonly preferredGoals: readonly AiGoal[];
  readonly utilityWeights: AiUtilityWeights;
}

export interface EliteAffixDefinition {
  readonly id: EliteAffixId;
  readonly nameKey: string;
  readonly mechanicKey: string;
  readonly preferredModules: readonly ModuleId[];
  readonly weightAdjustments: Partial<AiUtilityWeights>;
}

export interface EliteTemplateDefinition {
  readonly id: EliteTemplateId;
  readonly prototypeId: EnemyPrototypeId;
  readonly affixIds: readonly EliteAffixId[];
}

export interface AiDifficultyProfile {
  readonly id: AiDifficulty;
  readonly maximumMoveCandidates: number;
  readonly maximumTargetCandidatesPerModule: number;
  readonly maximumCandidates: number;
  readonly angleErrorMilliDegrees: number;
  readonly powerErrorPermille: number;
  readonly objectiveAwarenessPermille: number;
  readonly hazardAwarenessPermille: number;
}

export interface BossStageDefinition {
  readonly id: string;
  readonly nameKey: string;
  readonly mechanicKey: string;
  readonly cueKey: string;
  readonly preferredGoal: AiGoal;
  readonly preferredModules: readonly ModuleId[];
  readonly counters: readonly [BossCounterSignal, BossCounterSignal];
  readonly requiredProgress: number;
}

export interface BossDefinition {
  readonly id: BossId;
  readonly nameKey: string;
  readonly baseHp: number;
  readonly mainModuleId: ModuleId;
  readonly auxiliaryModuleIds: readonly ModuleId[];
  readonly selectedRoutes: readonly ModuleRouteSelection[];
  readonly utilityWeights: AiUtilityWeights;
  readonly stages: readonly BossStageDefinition[];
  readonly solutionRoutes: readonly [readonly BossCounterSignal[], readonly BossCounterSignal[]];
}

export interface BossRuntimeState {
  readonly bossId: BossId;
  readonly stageIndex: number;
  readonly stageProgress: number;
  readonly completed: boolean;
  readonly acceptedCommandIds: readonly string[];
  readonly stageHistory: readonly string[];
}

export interface AiControllerState {
  readonly actorId: string;
  readonly prototypeId: EnemyPrototypeId | null;
  readonly eliteTemplateId: EliteTemplateId | null;
  readonly bossId: BossId | null;
}

export interface AiAuthorityState {
  readonly schemaVersion: string;
  readonly rulesVersion: string;
  readonly rootSeed: number;
  readonly difficulty: AiDifficulty;
  readonly decisionIndex: number;
  readonly aiRngState: RngState;
  readonly aimErrorRngState: RngState;
  readonly controllers: readonly AiControllerState[];
  readonly bosses: readonly BossRuntimeState[];
}

export interface CreateAiAuthorityDefinition {
  readonly rootSeed: number;
  readonly difficulty: AiDifficulty;
  readonly controllers: readonly AiControllerState[];
}

export interface AiCandidateSeed {
  readonly candidateId: string;
  readonly goal: AiGoal;
  readonly command: BattleCommand;
}

export interface AiCandidateEvaluation extends AiCandidateSeed {
  readonly legal: boolean;
  readonly rejection: string | null;
  readonly utility: AiUtilityVector;
  readonly weightedScore: number;
}

export interface AiDecisionTrace {
  readonly actorId: string;
  readonly turnIndex: number;
  readonly decisionIndex: number;
  readonly difficulty: AiDifficulty;
  readonly selectedGoal: AiGoal;
  readonly selectedCandidateId: string;
  readonly selectedScore: number;
  readonly angleErrorMilliDegrees: number;
  readonly powerErrorPermille: number;
  readonly behaviorTrace: readonly BehaviorTraceEntry[];
  readonly candidates: readonly AiCandidateEvaluation[];
}

export interface AiDecision {
  readonly state: AiAuthorityState;
  readonly command: BattleCommand;
  readonly trace: AiDecisionTrace;
}

export interface AiEnemyPhaseExecution {
  readonly battleState: BattleState;
  readonly aiState: AiAuthorityState;
  readonly commands: readonly BattleCommand[];
  readonly events: readonly BattleEvent[];
  readonly traces: readonly AiDecisionTrace[];
}

export interface BossCounterEvent {
  readonly kind: "counter_applied" | "stage_changed" | "boss_completed" | "counter_ignored";
  readonly bossId: BossId;
  readonly commandId: string;
  readonly signal: BossCounterSignal;
  readonly fromStageId: string;
  readonly toStageId: string | null;
  readonly progress: number;
}

export interface BossCounterResult {
  readonly state: AiAuthorityState;
  readonly event: BossCounterEvent;
}

export interface AiCatalogIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface AiCatalogReport {
  readonly valid: boolean;
  readonly issues: readonly AiCatalogIssue[];
}

export interface AiDebugMarker {
  readonly candidateId: string;
  readonly x: number;
  readonly y: number;
  readonly selected: boolean;
  readonly score: number;
}

export interface AiDebugView {
  readonly title: string;
  readonly goal: AiGoal;
  readonly behaviorRows: readonly string[];
  readonly candidateRows: readonly string[];
  readonly markers: readonly AiDebugMarker[];
}

export interface AiBehaviorContext {
  readonly battle: BattleState;
  readonly actor: BattleActor;
  readonly flags: readonly AiBehaviorFlag[];
  readonly forcedGoal: AiGoal | null;
}
