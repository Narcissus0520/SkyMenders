import { createTerrainState } from "@skymenders/terrain-core";
import { describe, expect, it } from "vitest";

import { BATTLE_MAX_COMMANDS, reduceBattleCommand } from "../src/index.js";
import type { BattleState } from "../src/index.js";
import { battleFixture, commandBase, moduleCommand } from "./fixtures.js";

function actionState(overrides: Partial<BattleState> = {}): BattleState {
  return { ...battleFixture(), phase: "player_action", ...overrides };
}

function expectRejected(state: BattleState, command: object, message: string): void {
  expect(() => {
    reduceBattleCommand(state, command, 0);
  }).toThrow(message);
}

describe("battle reducer authority and fallback boundaries", () => {
  it("rejects invalid command indices and envelopes", () => {
    const state = battleFixture();
    const phase = {
      ...commandBase("system"),
      kind: "advance_phase",
      expectedPhase: "player_planning",
    };
    for (const commandIndex of [-1, 0.5, BATTLE_MAX_COMMANDS]) {
      expect(() => {
        reduceBattleCommand(state, phase, commandIndex);
      }).toThrow("index");
    }
    expectRejected(state, { ...phase, battleId: "battle:other" }, "battle id");
    expectRejected(state, { ...phase, expectedPhase: "enemy_action" }, "precondition");
    expectRejected(
      {
        ...state,
        phase: "battle_complete",
        objectives: state.objectives.map((objective) => ({
          ...objective,
          progress: objective.required,
          status: "completed" as const,
        })),
        outcome: { status: "victory", reason: "primary_completed" },
      },
      phase,
      "completed battle",
    );
  });

  it("enforces movement allowance, occupancy, standability, and stable support", () => {
    const state = actionState();
    const move = {
      ...commandBase("player:1"),
      kind: "move",
      destinationX: 2,
      destinationY: 1,
    };
    expectRejected(
      {
        ...state,
        actors: state.actors.map((actor) =>
          actor.id === "player:1" ? { ...actor, movementUsed: true } : actor,
        ),
      },
      move,
      "move again",
    );
    expectRejected(state, { ...move, destinationX: 1 }, "outside the actor allowance");
    expectRejected(state, { ...move, destinationX: 8 }, "outside the actor allowance");
    expectRejected(state, { ...move, destinationX: -1 }, "outside battle terrain");
    expectRejected(state, { ...move, destinationY: 0 }, "contains terrain");
    expectRejected(state, { ...move, destinationX: 4 }, "another actor");
    expectRejected(state, { ...move, destinationX: 2, destinationY: 2 }, "not standable");

    const objectState = actionState({
      worldObjects: [
        { id: "object:block", kind: "metal_object", x: 3, y: 1, mass: 100, active: true },
      ],
    });
    expectRejected(objectState, { ...move, destinationX: 3 }, "world object");

    const unstableTerrain = createTerrainState({
      width: 24,
      height: 12,
      fills: [
        { x: 0, y: 0, width: 1, height: 1, materialId: "terrain_alloy_frame" },
        { x: 2, y: 0, width: 22, height: 1, materialId: "terrain_alloy_frame" },
      ],
      supportRoots: [{ id: "anchor:isolated", kind: "fixed_anchor", x: 0, y: 0, capacity: 100 }],
    });
    const unstable = actionState({ terrain: unstableTerrain });
    expectRejected(unstable, { ...move, destinationX: 3 }, "support is unstable");
  });

  it("rejects disabled and wrong-team actors but accepts module commands through the reducer", () => {
    const state = actionState();
    expectRejected(state, { ...commandBase("enemy:1"), kind: "wait" }, "cannot act");
    const disabled = {
      ...state,
      actors: state.actors.map((actor) =>
        actor.id === "player:1"
          ? {
              ...actor,
              hp: 0,
              disabled: true,
              recoveryBeaconId: "beacon:player:1",
              actionEnded: true,
            }
          : actor,
      ),
    };
    expectRejected(disabled, { ...commandBase("player:1"), kind: "wait" }, "disabled actor");

    const result = reduceBattleCommand(
      state,
      moduleCommand(state, "player:1", "aux_reflector", 2, 2),
      0,
    );
    expect(result.events.map((event) => event.kind)).toContain("module_resolved");
    expect(result.events.map((event) => event.kind)).toContain("battle_effect_applied");
  });

  it("caps wait gains and permits a zero-effect wait when energy is full", () => {
    const state = actionState();
    const result = reduceBattleCommand(state, { ...commandBase("player:1"), kind: "wait" }, 0);
    expect(result.state.energy.current).toBe(result.state.energy.maximum);
    expect(result.events.filter((event) => event.kind === "battle_effect_applied")).toHaveLength(0);

    const capped = actionState({
      energy: {
        ...state.energy,
        current: 5,
        waitEnergyGrantedThisRound: state.energy.maximumWaitEnergyPerRound,
      },
    });
    expect(
      reduceBattleCommand(capped, { ...commandBase("player:1"), kind: "wait" }, 0).state.energy
        .current,
    ).toBe(5);
  });

  it("validates critical interactions and basic repair targets", () => {
    const state = actionState();
    expectRejected(
      state,
      { ...commandBase("player:1"), kind: "interact", targetId: "missing:target" },
      "not found",
    );
    const moduleObjective = actionState({
      objectives: state.objectives.map((objective) => ({
        ...objective,
        criticalInteraction: false,
        requiredModuleId: "main_fold_bridge",
      })),
    });
    expectRejected(
      moduleObjective,
      { ...commandBase("player:1"), kind: "interact", targetId: "tower:1" },
      "declared module",
    );
    expectRejected(
      state,
      {
        ...commandBase("player:1"),
        kind: "use_basic_action",
        action: "repair",
        targetId: "enemy:1",
      },
      "adjacent ally",
    );

    const fullRepair = reduceBattleCommand(
      state,
      {
        ...commandBase("player:1"),
        kind: "use_basic_action",
        action: "repair",
        targetId: "player:1",
      },
      0,
    );
    expect(fullRepair.state.actors.find((actor) => actor.id === "player:1")?.hp).toBe(100);
  });

  it("fails closed for illegal basic-push targets and destinations", () => {
    const state = actionState();
    const push = {
      ...commandBase("player:1"),
      kind: "use_basic_action",
      action: "push",
      targetId: "missing:target",
    };
    expectRejected(state, push, "adjacent actor or world object");
    expectRejected(state, { ...push, targetId: "player:1" }, "adjacent actor or world object");
    expectRejected(state, { ...push, targetId: "object:metal" }, "adjacent actor or world object");

    const adjacent = actionState({
      worldObjects: [
        { id: "object:target", kind: "metal_object", x: 2, y: 1, mass: 100, active: true },
      ],
    });
    const adjacentPush = { ...push, targetId: "object:target" };
    expectRejected(adjacent, { ...adjacentPush, targetX: 4, targetY: 1 }, "exceeds fallback range");

    const terrainBlocked = actionState({
      terrain: createTerrainState({
        width: 24,
        height: 12,
        fills: [
          { x: 0, y: 0, width: 24, height: 1, materialId: "terrain_alloy_frame" },
          { x: 3, y: 1, width: 1, height: 1, materialId: "terrain_cloud_soil" },
        ],
        supportRoots: [{ id: "anchor:push", kind: "fixed_anchor", x: 0, y: 0, capacity: 100_000 }],
      }),
      worldObjects: adjacent.worldObjects,
    });
    expectRejected(terrainBlocked, adjacentPush, "contains terrain");

    const actorBlocked = {
      ...adjacent,
      actors: adjacent.actors.map((actor) =>
        actor.id === "player:2" ? { ...actor, x: 3 } : actor,
      ),
    };
    expectRejected(actorBlocked, adjacentPush, "another actor");

    const objectBlocked = {
      ...adjacent,
      worldObjects: [
        ...adjacent.worldObjects,
        { id: "object:block", kind: "relic" as const, x: 3, y: 1, mass: 200, active: true },
      ],
    };
    expectRejected(objectBlocked, adjacentPush, "world object");
  });
});
