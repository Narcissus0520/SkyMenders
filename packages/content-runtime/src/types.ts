import type { RngState } from "@skymenders/deterministic-runtime";

import type { PveContentPack } from "@skymenders/content-schema";

export type ExpeditionNodeType = PveContentPack["regions"]["regions"][number]["nodePool"][number];
export type RobotId = PveContentPack["robots"]["robots"][number]["id"];
export type RewardDefinition = PveContentPack["routes"]["rewardPool"][number];

export interface ExpeditionNode {
  readonly id: string;
  readonly regionIndex: number;
  readonly layer: 0 | 1 | 2;
  readonly type: ExpeditionNodeType;
  readonly mapId: string | null;
  readonly eventId: string | null;
  readonly bossId: string | null;
  readonly risk: 1 | 2 | 3;
  readonly nextNodeIds: readonly string[];
}

export interface ExpeditionRegionPlan {
  readonly id: string;
  readonly regionIndex: number;
  readonly layers: readonly [
    readonly ExpeditionNode[],
    readonly ExpeditionNode[],
    readonly [ExpeditionNode],
  ];
}

export interface ExpeditionPlan {
  readonly schemaVersion: "0.1.0";
  readonly contentVersion: string;
  readonly rulesVersion: "0.6.0";
  readonly seed: number;
  readonly regions: readonly ExpeditionRegionPlan[];
}

export interface ExpeditionDurationPath {
  readonly nodeIds: readonly string[];
  readonly estimatedMinutes: number;
}

export interface RobotRunState {
  readonly robotId: RobotId;
  readonly hp: number;
  readonly maxHp: number;
  readonly structuralDamage: number;
  readonly disabled: boolean;
}

export interface ExpeditionState {
  readonly plan: ExpeditionPlan;
  readonly status: "active" | "victory" | "defeat";
  readonly regionIndex: number;
  readonly layer: 0 | 1 | 2;
  readonly completedNodeIds: readonly string[];
  readonly robots: readonly RobotRunState[];
  readonly researchEarned: number;
  readonly supplies: number;
  readonly routeRevealDepth: number;
  readonly inventory: {
    readonly moduleIds: readonly string[];
    readonly upgradeRouteIds: readonly string[];
    readonly temporaryModIds: readonly string[];
    readonly consumables: number;
  };
  readonly restartUsedNodeIds: readonly string[];
}

export interface RouteNodeVisibility {
  readonly id: string;
  readonly layer: 0 | 1 | 2;
  readonly type: ExpeditionNodeType | null;
  readonly risk: 1 | 2 | 3 | null;
  readonly current: boolean;
}

export interface NodeOutcome {
  readonly victory: boolean;
  readonly robotHp: Readonly<Record<string, number>>;
  readonly structuralDamage: Readonly<Record<string, number>>;
  readonly researchEarned: number;
  readonly suppliesEarned: number;
}

export interface RewardContext {
  readonly seed: number;
  readonly rewardIndex: number;
  readonly squadRobotIds: readonly RobotId[];
  readonly unlockedModuleIds: readonly string[];
  readonly ownedModuleIds: readonly string[];
  readonly previousCategory: string | null;
}

export interface LockedRewardSet {
  readonly lockId: string;
  readonly choices: readonly [RewardDefinition, RewardDefinition, RewardDefinition];
  readonly rngState: RngState;
}

export interface RunModifiers {
  readonly movementEfficiencyPermille: number;
  readonly energyMaximumBonus: number;
  readonly fallDamageReductionPermille: number;
  readonly repairEfficiencyPermille: number;
}

export interface ProgressionState {
  readonly research: number;
  readonly unlockedIds: readonly string[];
  readonly completedAchievementIds: readonly string[];
  readonly compendiumEntryIds: readonly string[];
  readonly metrics: Readonly<Record<string, number>>;
}

export interface TutorialState {
  readonly tutorialId: string;
  readonly stepIndex: number;
  readonly completed: boolean;
}
