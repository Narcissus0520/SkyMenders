import { describe, expect, it } from "vitest";

import { DEFAULT_ENEMY_BEHAVIOR_TREE, evaluateBehaviorTree } from "../src/index.js";
import type { BehaviorTreeNode } from "../src/index.js";
import { aiFixture } from "./fixtures.js";

describe("macro behavior tree", () => {
  it("prioritizes recovery, objective work, support disruption, control, and pressure", () => {
    const fixture = aiFixture();
    const actor = fixture.battle.actors.find((candidate) => candidate.team === "enemy");
    if (actor === undefined) throw new Error("enemy fixture missing");
    const critical = { ...actor, hp: 20, mainModuleId: "main_bubble_capsule" as const };
    expect(
      evaluateBehaviorTree(DEFAULT_ENEMY_BEHAVIOR_TREE, {
        battle: fixture.battle,
        actor: critical,
        flags: ["protector"],
        forcedGoal: null,
      }).goal,
    ).toBe("recover");
    expect(
      evaluateBehaviorTree(DEFAULT_ENEMY_BEHAVIOR_TREE, {
        battle: fixture.battle,
        actor,
        flags: ["objective_carrier"],
        forcedGoal: null,
      }).goal,
    ).toBe("secure_objective");
    expect(
      evaluateBehaviorTree(DEFAULT_ENEMY_BEHAVIOR_TREE, {
        battle: fixture.battle,
        actor,
        flags: ["support_disruptor"],
        forcedGoal: null,
      }).goal,
    ).toBe("disrupt_support");
    expect(
      evaluateBehaviorTree(DEFAULT_ENEMY_BEHAVIOR_TREE, {
        battle: fixture.battle,
        actor,
        flags: ["field_controller"],
        forcedGoal: null,
      }).goal,
    ).toBe("control_field");
    expect(
      evaluateBehaviorTree(DEFAULT_ENEMY_BEHAVIOR_TREE, {
        battle: fixture.battle,
        actor,
        flags: [],
        forcedGoal: null,
      }).goal,
    ).toBe("pressure_target");
  });

  it("honors a boss stage override without reading any player draft input", () => {
    const fixture = aiFixture();
    const actor = fixture.battle.actors.find((candidate) => candidate.team === "enemy");
    if (actor === undefined) throw new Error("enemy fixture missing");
    const evaluation = evaluateBehaviorTree(DEFAULT_ENEMY_BEHAVIOR_TREE, {
      battle: fixture.battle,
      actor,
      flags: [],
      forcedGoal: "secure_objective",
    });
    expect(evaluation.goal).toBe("secure_objective");
    expect(evaluation.trace).toEqual([
      { nodeId: "boss_stage_override", kind: "goal", status: "success" },
    ]);
  });

  it("supports selector fallthrough, always conditions, reposition, and wait leaves", () => {
    const fixture = aiFixture();
    const actor = fixture.battle.actors.find((candidate) => candidate.team === "enemy");
    if (actor === undefined) throw new Error("enemy fixture missing");
    const noHostiles = {
      ...fixture.battle,
      actors: fixture.battle.actors.filter((candidate) => candidate.team === "enemy"),
    };
    expect(
      evaluateBehaviorTree(DEFAULT_ENEMY_BEHAVIOR_TREE, {
        battle: noHostiles,
        actor,
        flags: [],
        forcedGoal: null,
      }).goal,
    ).toBe("reposition");
    expect(
      evaluateBehaviorTree(DEFAULT_ENEMY_BEHAVIOR_TREE, {
        battle: noHostiles,
        actor: { ...actor, movementUsed: true },
        flags: [],
        forcedGoal: null,
      }).goal,
    ).toBe("wait");

    const customTree: BehaviorTreeNode = {
      id: "custom",
      kind: "selector",
      children: [
        {
          id: "failed-sequence",
          kind: "sequence",
          children: [
            { id: "critical", kind: "condition", condition: "self_critical" },
            { id: "recover", kind: "goal", goal: "recover" },
          ],
        },
        {
          id: "always-sequence",
          kind: "sequence",
          children: [
            { id: "always", kind: "condition", condition: "always" },
            { id: "wait", kind: "goal", goal: "wait" },
          ],
        },
      ],
    };
    expect(
      evaluateBehaviorTree(customTree, {
        battle: noHostiles,
        actor,
        flags: [],
        forcedGoal: null,
      }).goal,
    ).toBe("wait");
  });
});
