import { describe, expect, it } from "vitest";

import {
  applyActorDurabilityDamage,
  assertBattleState,
  findBattleActor,
  recoverTeamAfterNode,
  repairBattleActor,
} from "../src/index.js";
import { battleFixture } from "./fixtures.js";

describe("dual durability and recovery", () => {
  it("derives at most two source-specific faults and keeps critical abilities available", () => {
    let state = battleFixture();
    state = applyActorDurabilityDamage(state, "player:1", {
      hpDamage: 10,
      structuralDamage: 35,
      source: "collision",
      sourceId: "hazard:1",
    }).state;
    state = applyActorDurabilityDamage(state, "player:1", {
      hpDamage: 0,
      structuralDamage: 30,
      source: "magnetic",
      sourceId: "hazard:2",
    }).state;
    state = applyActorDurabilityDamage(state, "player:1", {
      hpDamage: 0,
      structuralDamage: 30,
      source: "fall",
      sourceId: "hazard:3",
    }).state;
    const actor = findBattleActor(state, "player:1");
    expect(actor.hp).toBe(90);
    expect(actor.structuralDamage).toBe(100);
    expect(actor.faults).toHaveLength(2);
    expect(actor.faults.map((fault) => fault.kind)).toEqual(["aiming_fault", "stability_fault"]);
    expect(actor.mainModuleId).toBe("main_fold_bridge");
    expect(() => {
      assertBattleState(state);
    }).not.toThrow();
  });

  it("applies bubble and stabilizer mitigation before clamping durability", () => {
    const state = battleFixture();
    const protectedState = {
      ...state,
      fieldEffects: [
        {
          id: "effect:bubble",
          kind: "bubble" as const,
          sourceActorId: "player:2",
          targetActorId: "player:1",
          x: 1,
          y: 1,
          radius: 1,
          directionMilliDegrees: 0,
          magnitude: 600,
          remainingRounds: 2,
          consumed: false,
        },
        {
          id: "effect:stabilizer",
          kind: "stabilizer" as const,
          sourceActorId: "player:2",
          targetActorId: "player:1",
          x: 1,
          y: 1,
          radius: 0,
          directionMilliDegrees: 0,
          magnitude: 500,
          remainingRounds: 2,
          consumed: false,
        },
      ],
    };
    const result = applyActorDurabilityDamage(protectedState, "player:1", {
      hpDamage: 20,
      structuralDamage: 20,
      source: "fall",
      sourceId: "fall:1",
    });
    const actor = findBattleActor(result.state, "player:1");
    expect(actor.hp).toBe(90);
    expect(actor.structuralDamage).toBe(10);
  });

  it("makes an existing stability fault increase later fall or collision damage", () => {
    const state = battleFixture({
      actorOverrides: {
        "player:1": {
          structuralDamage: 35,
          faults: [{ kind: "stability_fault", source: "collision", severity: "minor" }],
        },
      },
    });
    const result = applyActorDurabilityDamage(state, "player:1", {
      hpDamage: 0,
      structuralDamage: 5,
      source: "collision",
      sourceId: "hazard:repeat",
    });
    expect(findBattleActor(result.state, "player:1").structuralDamage).toBe(45);

    const recovered = recoverTeamAfterNode(
      battleFixture({
        actorOverrides: {
          "player:1": {
            structuralDamage: 65,
            faults: [{ kind: "stability_fault", source: "collision", severity: "major" }],
          },
        },
      }),
      state.config,
    );
    expect(findBattleActor(recovered, "player:1")).toMatchObject({
      structuralDamage: 55,
      faults: [{ kind: "stability_fault", source: "collision", severity: "minor" }],
    });
  });

  it("disables robots, drops task objects safely, ends a wiped battle, and recovers by configuration", () => {
    let state = battleFixture({
      actorOverrides: { "player:1": { carriedObjectId: "object:core" } },
    });
    const first = applyActorDurabilityDamage(state, "player:1", {
      hpDamage: 200,
      structuralDamage: 100,
      source: "fall",
      sourceId: "void:1",
    });
    state = first.state;
    const disabled = findBattleActor(state, "player:1");
    const dropped = state.worldObjects.find((object) => object.id === "object:core");
    if (dropped === undefined) throw new Error("fixture task object is missing");
    expect(disabled).toMatchObject({ hp: 0, disabled: true, recoveryBeaconId: "beacon:player:1" });
    expect(disabled.carriedObjectId).toBeNull();
    expect(state.terrain.materials[dropped.y * state.terrain.width + dropped.x]).toBe(0);
    expect(state.terrain.materials[(dropped.y - 1) * state.terrain.width + dropped.x]).not.toBe(0);
    for (const actorId of ["player:2", "player:3"]) {
      state = applyActorDurabilityDamage(state, actorId, {
        hpDamage: 200,
        structuralDamage: 0,
        source: "collision",
        sourceId: "boss:1",
      }).state;
    }
    expect(state.outcome).toEqual({ status: "defeat", reason: "team_disabled" });
    const recovered = recoverTeamAfterNode(state, state.config);
    expect(recovered.actors.find((actor) => actor.id === "player:1")).toMatchObject({
      hp: 35,
      structuralDamage: 90,
      disabled: false,
      recoveryBeaconId: null,
    });
  });

  it("repairs active actors but rejects disabled targets and invalid amounts", () => {
    const state = battleFixture({ actorOverrides: { "player:1": { hp: 70 } } });
    expect(
      findBattleActor(repairBattleActor(state, "player:1", 20, "player:2").state, "player:1").hp,
    ).toBe(90);
    expect(() => {
      repairBattleActor(state, "player:1", 0, "player:2");
    }).toThrow();
    const disabled = applyActorDurabilityDamage(state, "player:1", {
      hpDamage: 100,
      structuralDamage: 0,
      source: "collision",
      sourceId: "hazard:1",
    }).state;
    expect(() => {
      repairBattleActor(disabled, "player:1", 10, "player:2");
    }).toThrow("disabled");
  });
});
