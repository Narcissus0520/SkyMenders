import {
  addTerrainSupportRoot,
  createTerrainState,
  getTerrainCell,
} from "@skymenders/terrain-core";
import { describe, expect, it } from "vitest";

import {
  advanceBattlePhase,
  applyObjectiveSignal,
  failObjective,
  resolveModuleCommand,
} from "../src/index.js";
import { battleFixture, moduleCommand } from "./fixtures.js";

describe("phase settlement and objectives", () => {
  it("expires fields, temporary support, and temporary terrain before deterministic collapse", () => {
    let state = battleFixture({
      routes: {
        "enemy:1": [{ moduleId: "aux_terrain_foam", routeId: "terrain_foam_elastic" }],
        "enemy:4": [{ moduleId: "main_support_frame", routeId: "support_frame_mobile" }],
      },
    });
    state = resolveModuleCommand(
      state,
      moduleCommand(state, "enemy:1", "aux_terrain_foam", 11, 1),
      state.config,
    ).state;
    state = resolveModuleCommand(
      state,
      moduleCommand(state, "enemy:4", "main_support_frame", 19, 0),
      state.config,
    ).state;
    state = {
      ...state,
      phase: "environment_settlement",
      fieldEffects: [
        ...state.fieldEffects,
        {
          id: "field:expiring",
          kind: "jammer",
          sourceActorId: "enemy:2",
          targetActorId: null,
          x: 13,
          y: 1,
          radius: 2,
          directionMilliDegrees: 0,
          magnitude: 500,
          remainingRounds: 1,
          consumed: false,
        },
      ],
    };
    const first = advanceBattlePhase(state);
    expect(first.state.terrain.supportRoots.some((root) => root.kind === "support_structure")).toBe(
      false,
    );
    expect(first.state.fieldEffects).toHaveLength(0);
    expect(first.state.temporaryTerrain[0]?.remainingRounds).toBe(1);
    const second = advanceBattlePhase({ ...first.state, phase: "environment_settlement" });
    expect(second.state.temporaryTerrain).toHaveLength(0);
    expect(getTerrainCell(second.state.terrain, 11, 1)).toBeNull();
    expect(second.effects.map((effect) => effect.kind)).toContain("terrain_damaged");
  });

  it("retains multi-round fields and supports while reporting deterministic collapse", () => {
    const terrain = createTerrainState({
      width: 24,
      height: 12,
      fills: [
        { x: 0, y: 0, width: 24, height: 1, materialId: "terrain_alloy_frame" },
        { x: 5, y: 5, width: 2, height: 1, materialId: "terrain_cloud_soil" },
      ],
      supportRoots: [{ id: "anchor:base", kind: "fixed_anchor", x: 0, y: 0, capacity: 100_000 }],
    });
    const supportedTerrain = addTerrainSupportRoot(terrain, {
      id: "support:lasting",
      kind: "support_structure",
      x: 2,
      y: 0,
      capacity: 1_000,
    });
    const base = battleFixture({ definitionOverrides: { terrain: supportedTerrain } });
    const state = {
      ...base,
      phase: "environment_settlement" as const,
      fieldEffects: [
        {
          id: "field:lasting",
          kind: "wind_field" as const,
          sourceActorId: "enemy:3",
          targetActorId: null,
          x: 5,
          y: 5,
          radius: 2,
          directionMilliDegrees: 0,
          magnitude: 300,
          remainingRounds: 2,
          consumed: false,
        },
      ],
      temporarySupports: [
        { effectId: "effect:support", rootId: "support:lasting", remainingRounds: 2 },
      ],
    };
    const settled = advanceBattlePhase(state);
    expect(settled.state.fieldEffects[0]?.remainingRounds).toBe(1);
    expect(settled.state.temporarySupports[0]?.remainingRounds).toBe(1);
    expect(settled.state.terrain.supportRoots.map((root) => root.id)).toContain("support:lasting");
    expect(settled.effects.map((effect) => effect.kind)).toContain("terrain_collapsed");
  });

  it("requires every active actor to finish before changing action teams", () => {
    const planning = battleFixture();
    const playerAction = advanceBattlePhase(planning).state;
    expect(playerAction.phase).toBe("player_action");
    expect(() => advanceBattlePhase(playerAction)).toThrow("every active actor");
    const playersFinished = {
      ...playerAction,
      actors: playerAction.actors.map((actor) =>
        actor.team === "player" ? { ...actor, actionEnded: true } : actor,
      ),
    };
    expect(advanceBattlePhase(playersFinished).state.phase).toBe("enemy_action");
  });

  it("progresses matching objectives, completes the primary outcome, and supports explicit failure", () => {
    const state = battleFixture();
    const first = applyObjectiveSignal(state, {
      trigger: "repair_energy_tower",
      sourceId: "player:1",
      targetId: "tower:1",
      amount: 1,
    });
    expect(first.state.outcome.status).toBe("ongoing");
    const complete = applyObjectiveSignal(first.state, {
      trigger: "repair_energy_tower",
      sourceId: "player:2",
      targetId: "tower:1",
      amount: 10,
    });
    expect(complete.state.outcome).toEqual({ status: "victory", reason: "primary_completed" });
    expect(complete.state.phase).toBe("battle_complete");
    expect(() =>
      applyObjectiveSignal(state, {
        trigger: "repair_energy_tower",
        sourceId: "player:1",
        targetId: "tower:1",
        amount: 0,
      }),
    ).toThrow();
    const failed = failObjective(state, "objective:primary", "environment");
    expect(failed.state.objectives[0]?.status).toBe("failed");
    expect(failed.state.outcome).toEqual({ status: "defeat", reason: "primary_failed" });
    expect(failed.state.phase).toBe("battle_complete");
    expect(failObjective(failed.state, "objective:primary", "environment").effects).toEqual([]);
  });

  it("settles unsupported actors and applies configured fall damage", () => {
    const state = battleFixture({ actorOverrides: { "player:1": { y: 10 } } });
    const settled = advanceBattlePhase({ ...state, phase: "environment_settlement" });
    expect(settled.state.actors.find((actor) => actor.id === "player:1")).toMatchObject({
      y: 1,
      hp: 65,
      structuralDamage: 35,
      faults: [{ kind: "mobility_fault", source: "fall", severity: "minor" }],
    });
    expect(settled.effects.map((effect) => effect.kind)).toContain("actor_moved");
  });

  it("deactivates a task object that falls out and fails its primary objective", () => {
    const terrain = createTerrainState({
      width: 24,
      height: 12,
      fills: [
        { x: 0, y: 0, width: 14, height: 1, materialId: "terrain_alloy_frame" },
        { x: 15, y: 0, width: 9, height: 1, materialId: "terrain_alloy_frame" },
      ],
      supportRoots: [
        { id: "anchor:left", kind: "fixed_anchor", x: 0, y: 0, capacity: 100_000 },
        { id: "anchor:right", kind: "fixed_anchor", x: 15, y: 0, capacity: 100_000 },
      ],
    });
    const state = battleFixture({
      objectives: [
        {
          id: "objective:core",
          role: "primary",
          trigger: "deliver_energy_core",
          progress: 0,
          required: 1,
          status: "active",
          criticalInteraction: false,
          requiredModuleId: null,
          targetId: "object:core",
        },
      ],
      definitionOverrides: { terrain },
    });
    const settled = advanceBattlePhase({ ...state, phase: "environment_settlement" });
    expect(settled.state.worldObjects.find((object) => object.id === "object:core")?.active).toBe(
      false,
    );
    expect(settled.state.objectives[0]?.status).toBe("failed");
    expect(settled.state.outcome).toEqual({ status: "defeat", reason: "primary_failed" });
    expect(settled.state.phase).toBe("battle_complete");
  });

  it("disables an unsupported actor that falls out of the battle", () => {
    const terrain = createTerrainState({
      width: 24,
      height: 12,
      fills: [{ x: 2, y: 0, width: 22, height: 1, materialId: "terrain_alloy_frame" }],
      supportRoots: [
        { id: "anchor:survivors", kind: "fixed_anchor", x: 2, y: 0, capacity: 100_000 },
      ],
    });
    const state = battleFixture({ definitionOverrides: { terrain } });
    const settled = advanceBattlePhase({ ...state, phase: "environment_settlement" });
    expect(settled.state.actors.find((actor) => actor.id === "player:1")).toMatchObject({
      hp: 0,
      structuralDamage: 100,
      disabled: true,
      recoveryBeaconId: "beacon:player:1",
    });
    expect(settled.state.outcome.status).toBe("ongoing");
  });
});
