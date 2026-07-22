import { describe, expect, it } from "vitest";

import { executeBattleCommands, reduceBattleCommand } from "../src/index.js";
import { battleFixture, commandBase } from "./fixtures.js";

describe("whole-round battle reducer", () => {
  it("runs planning, three player actions, enemy actions, settlement, carry, and regeneration", () => {
    const initial = battleFixture({
      actorOverrides: { "player:2": { hp: 80 } },
      definitionOverrides: { initialEnergy: 5 },
    });
    const commands = [
      {
        ...commandBase("system", 0, "cmd:phase:player"),
        kind: "advance_phase",
        expectedPhase: "player_planning",
      },
      {
        ...commandBase("player:1", 0, "cmd:move:p1"),
        kind: "move",
        destinationX: 2,
        destinationY: 1,
      },
      { ...commandBase("player:1", 0, "cmd:wait:p1"), kind: "wait" },
      {
        ...commandBase("player:2", 0, "cmd:repair:p2"),
        kind: "use_basic_action",
        action: "repair",
        targetId: "player:2",
      },
      {
        ...commandBase("player:3", 0, "cmd:interact:p3"),
        kind: "interact",
        targetId: "tower:1",
      },
      {
        ...commandBase("system", 0, "cmd:phase:enemy"),
        kind: "advance_phase",
        expectedPhase: "player_action",
      },
      ...[1, 2, 3, 4, 5].map((index) => ({
        ...commandBase(`enemy:${index}`, 0, `cmd:wait:e${index}`),
        kind: "wait" as const,
      })),
      {
        ...commandBase("system", 0, "cmd:phase:environment"),
        kind: "advance_phase",
        expectedPhase: "enemy_action",
      },
      {
        ...commandBase("system", 0, "cmd:phase:settle"),
        kind: "advance_phase",
        expectedPhase: "environment_settlement",
      },
    ];
    const execution = executeBattleCommands(initial, commands);
    expect(execution.finalState).toMatchObject({ turnIndex: 1, phase: "player_planning" });
    expect(execution.finalState.energy).toMatchObject({
      current: 12,
      waitEnergyGrantedThisRound: 0,
    });
    expect(execution.finalState.actors.find((actor) => actor.id === "player:1")).toMatchObject({
      x: 2,
      movementUsed: false,
      actionEnded: false,
    });
    expect(execution.finalState.actors.find((actor) => actor.id === "player:2")?.hp).toBe(85);
    expect(execution.finalState.objectives[0]?.progress).toBe(1);
    expect(execution.checkpoints).toHaveLength(commands.length);
    expect(execution.events.map((event) => event.sequence)).toEqual(
      execution.events.map((_, index) => index),
    );
  });

  it("keeps movement and critical interactions usable with zero energy", () => {
    let state = battleFixture({ definitionOverrides: { initialEnergy: 0 } });
    state = reduceBattleCommand(
      state,
      {
        ...commandBase("system", 0, "cmd:phase"),
        kind: "advance_phase",
        expectedPhase: "player_planning",
      },
      0,
    ).state;
    state = reduceBattleCommand(
      state,
      {
        ...commandBase("player:1", 0, "cmd:move"),
        kind: "move",
        destinationX: 2,
        destinationY: 1,
      },
      1,
    ).state;
    const interacted = reduceBattleCommand(
      state,
      {
        ...commandBase("player:1", 0, "cmd:interact"),
        kind: "interact",
        targetId: "tower:1",
      },
      2,
    );
    expect(interacted.state.energy.current).toBe(0);
    expect(interacted.state.objectives[0]?.progress).toBe(1);
  });

  it("provides zero-energy push and repair fallbacks and enforces per-actor limits", () => {
    let state = battleFixture({
      actorOverrides: { "player:1": { hp: 90 } },
      definitionOverrides: {
        initialEnergy: 0,
        worldObjects: [
          { id: "object:metal", kind: "metal_object", x: 8, y: 1, mass: 100, active: true },
        ],
      },
    });
    state = reduceBattleCommand(
      state,
      {
        ...commandBase("system", 0, "cmd:phase"),
        kind: "advance_phase",
        expectedPhase: "player_planning",
      },
      0,
    ).state;
    const repaired = reduceBattleCommand(
      state,
      {
        ...commandBase("player:1", 0, "cmd:basic-repair"),
        kind: "use_basic_action",
        action: "repair",
        targetId: "player:1",
      },
      1,
    ).state;
    expect(repaired.actors.find((actor) => actor.id === "player:1")?.hp).toBe(95);
    expect(() =>
      reduceBattleCommand(repaired, { ...commandBase("player:1"), kind: "wait" }, 2),
    ).toThrow("already ended");

    const pushState = reduceBattleCommand(
      state,
      {
        ...commandBase("player:3", 0, "cmd:basic-push"),
        kind: "use_basic_action",
        action: "push",
        targetId: "object:metal",
        targetX: 9,
        targetY: 1,
      },
      1,
    ).state;
    expect(pushState.worldObjects.find((object) => object.id === "object:metal")).toMatchObject({
      x: 9,
      y: 1,
    });
  });

  it("fails closed on phase, turn, movement, authority, and log violations", () => {
    const state = battleFixture();
    expect(() =>
      reduceBattleCommand(state, { ...commandBase("player:1"), kind: "wait" }, 0),
    ).toThrow("cannot act");
    expect(() =>
      reduceBattleCommand(
        state,
        {
          ...commandBase("player:1"),
          kind: "advance_phase",
          expectedPhase: "player_planning",
        },
        0,
      ),
    ).toThrow("authority system");
    expect(() =>
      reduceBattleCommand(
        state,
        {
          ...commandBase("system", 1),
          kind: "advance_phase",
          expectedPhase: "player_planning",
        },
        0,
      ),
    ).toThrow("turn index");
    expect(() =>
      executeBattleCommands(
        state,
        Array.from({ length: 100_001 }, () => null),
      ),
    ).toThrow("cannot exceed");
  });
});
