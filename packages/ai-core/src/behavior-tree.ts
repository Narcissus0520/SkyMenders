import { actorHasModule, effectiveMoveDistance } from "@skymenders/battle-core";

import type {
  AiBehaviorContext,
  AiBehaviorEvaluation,
  AiGoal,
  BehaviorConditionId,
  BehaviorTraceEntry,
  BehaviorTreeNode,
} from "./types.js";

export const DEFAULT_ENEMY_BEHAVIOR_TREE: BehaviorTreeNode = Object.freeze({
  id: "root",
  kind: "selector",
  children: [
    sequence("self_recovery", [condition("self_critical"), goal("recover", "recover_self")]),
    sequence("ally_recovery", [condition("ally_needs_repair"), goal("recover", "recover_ally")]),
    sequence("objective", [
      condition("objective_available"),
      goal("secure_objective", "secure_objective"),
    ]),
    sequence("support", [
      condition("profile_disrupts_support"),
      goal("disrupt_support", "disrupt_support"),
    ]),
    sequence("fields", [
      condition("profile_controls_fields"),
      goal("control_field", "control_field"),
    ]),
    sequence("pressure", [
      condition("hostile_available"),
      goal("pressure_target", "pressure_target"),
    ]),
    sequence("movement", [condition("movement_available"), goal("reposition", "reposition")]),
    goal("wait", "wait"),
  ],
});

export function evaluateBehaviorTree(
  tree: BehaviorTreeNode,
  context: AiBehaviorContext,
): AiBehaviorEvaluation {
  if (context.forcedGoal !== null) {
    return {
      goal: context.forcedGoal,
      trace: [{ nodeId: "boss_stage_override", kind: "goal", status: "success" }],
    };
  }
  const trace: BehaviorTraceEntry[] = [];
  const result = evaluateNode(tree, context, trace);
  return { goal: result.goal ?? "wait", trace };
}

function evaluateNode(
  node: BehaviorTreeNode,
  context: AiBehaviorContext,
  trace: BehaviorTraceEntry[],
): { readonly success: boolean; readonly goal: AiGoal | null } {
  if (node.kind === "condition") {
    const success = evaluateCondition(node.condition, context);
    trace.push({ nodeId: node.id, kind: node.kind, status: success ? "success" : "failure" });
    return { success, goal: null };
  }
  if (node.kind === "goal") {
    trace.push({ nodeId: node.id, kind: node.kind, status: "success" });
    return { success: true, goal: node.goal };
  }
  if (node.kind === "sequence") {
    for (const child of node.children) {
      const result = evaluateNode(child, context, trace);
      if (!result.success) {
        trace.push({ nodeId: node.id, kind: node.kind, status: "failure" });
        return { success: false, goal: null };
      }
      if (result.goal !== null) {
        trace.push({ nodeId: node.id, kind: node.kind, status: "success" });
        return result;
      }
    }
    trace.push({ nodeId: node.id, kind: node.kind, status: "success" });
    return { success: true, goal: null };
  }
  for (const child of node.children) {
    const result = evaluateNode(child, context, trace);
    if (result.success) {
      trace.push({ nodeId: node.id, kind: node.kind, status: "success" });
      return result;
    }
  }
  trace.push({ nodeId: node.id, kind: node.kind, status: "failure" });
  return { success: false, goal: null };
}

function evaluateCondition(conditionId: BehaviorConditionId, context: AiBehaviorContext): boolean {
  const { actor, battle, flags } = context;
  switch (conditionId) {
    case "self_critical":
      return hpPermille(actor.hp, actor.maxHp) <= 350 && canRepair(actor);
    case "ally_needs_repair":
      return (
        flags.includes("repair_capable") &&
        battle.actors.some(
          (candidate) =>
            candidate.team === actor.team &&
            !candidate.disabled &&
            hpPermille(candidate.hp, candidate.maxHp) <= 550,
        )
      );
    case "objective_available":
      return (
        flags.includes("objective_carrier") &&
        battle.worldObjects.some((object) => object.active && object.kind === "task_object")
      );
    case "profile_disrupts_support":
      return flags.includes("support_disruptor");
    case "profile_controls_fields":
      return flags.includes("field_controller") || flags.includes("protector");
    case "hostile_available":
      return battle.actors.some(
        (candidate) =>
          candidate.team !== actor.team && candidate.team !== "neutral" && !candidate.disabled,
      );
    case "movement_available":
      return !actor.movementUsed && effectiveMoveDistance(actor, battle.config) > 0;
    case "always":
      return true;
  }
}

function canRepair(actor: AiBehaviorContext["actor"]): boolean {
  return actorHasModule(actor, "aux_repair_spray") || actorHasModule(actor, "main_bubble_capsule");
}

function hpPermille(hp: number, maxHp: number): number {
  return Math.trunc((hp * 1_000) / maxHp);
}

function condition(id: BehaviorConditionId): BehaviorTreeNode {
  return { id: `condition:${id}`, kind: "condition", condition: id };
}

function goal(goalId: AiGoal, id: string): BehaviorTreeNode {
  return { id: `goal:${id}`, kind: "goal", goal: goalId };
}

function sequence(id: string, children: readonly BehaviorTreeNode[]): BehaviorTreeNode {
  return { id: `sequence:${id}`, kind: "sequence", children };
}
