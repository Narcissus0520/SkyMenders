import {
  availableNodes,
  completeExpeditionNode,
  createExpeditionState,
  generateExpeditionPlan,
  generateLockedRewards,
} from "@skymenders/content-runtime";
import type {
  ExpeditionNode,
  ExpeditionState,
  LockedRewardSet,
  NodeOutcome,
  RobotId,
} from "@skymenders/content-runtime";
import type { PveContentPack } from "@skymenders/content-schema";

export interface PveFlowView {
  readonly status: ExpeditionState["status"];
  readonly regionIndex: number;
  readonly layer: number;
  readonly completedNodes: number;
  readonly availableNodes: readonly ExpeditionNode[];
}

export class PveFlowModel {
  private run: ExpeditionState | null = null;

  constructor(private readonly pack: PveContentPack) {}

  start(seed: number, robotIds: readonly RobotId[]): PveFlowView {
    this.run = createExpeditionState(
      generateExpeditionPlan(this.pack, seed),
      robotIds,
      this.pack.progression.initialModuleIds,
    );
    return this.view();
  }

  view(): PveFlowView {
    if (this.run === null) throw new Error("expedition has not started");
    return {
      status: this.run.status,
      regionIndex: this.run.regionIndex,
      layer: this.run.layer,
      completedNodes: this.run.completedNodeIds.length,
      availableNodes: availableNodes(this.run),
    };
  }

  completeNode(nodeId: string, outcome: NodeOutcome): PveFlowView {
    if (this.run === null) throw new Error("expedition has not started");
    this.run = completeExpeditionNode(this.run, nodeId, outcome);
    return this.view();
  }

  rewards(
    unlockedModuleIds: readonly string[],
    ownedModuleIds: readonly string[],
  ): LockedRewardSet {
    if (this.run === null || this.run.completedNodeIds.length === 0) {
      throw new Error("a completed node is required before rewards");
    }
    return generateLockedRewards(this.pack, {
      seed: this.run.plan.seed,
      rewardIndex: this.run.completedNodeIds.length - 1,
      squadRobotIds: this.run.robots.map((robot) => robot.robotId),
      unlockedModuleIds,
      ownedModuleIds,
      previousCategory: null,
    });
  }
}
