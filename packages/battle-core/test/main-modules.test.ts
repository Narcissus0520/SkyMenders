import { createTerrainState, getTerrainCell } from "@skymenders/terrain-core";
import { describe, expect, it } from "vitest";

import { findBattleActor, resolveModuleCommand } from "../src/index.js";
import type { ModuleRouteSelection } from "../src/index.js";
import { battleFixture, moduleCommand } from "./fixtures.js";

function withRoute(actorId: string, selection: ModuleRouteSelection) {
  return battleFixture({ routes: { [actorId]: [selection] } });
}

describe("eight main module mechanics", () => {
  it("builds temporary bridges only between legal supports and implements both routes", () => {
    const terrain = createTerrainState({
      width: 24,
      height: 12,
      fills: [
        { x: 0, y: 0, width: 24, height: 1, materialId: "terrain_alloy_frame" },
        { x: 1, y: 1, width: 1, height: 2, materialId: "terrain_alloy_frame" },
        { x: 5, y: 1, width: 1, height: 2, materialId: "terrain_alloy_frame" },
      ],
      supportRoots: [{ id: "anchor:bridge", kind: "fixed_anchor", x: 0, y: 0, capacity: 100_000 }],
    });
    const reinforced = battleFixture({
      routes: {
        "player:1": [{ moduleId: "main_fold_bridge", routeId: "fold_bridge_reinforced" }],
      },
      actorOverrides: { "player:1": { x: 1, y: 3 } },
      definitionOverrides: { terrain },
    });
    const reinforcedResult = resolveModuleCommand(
      reinforced,
      moduleCommand(reinforced, "player:1", "main_fold_bridge", 4, 2),
      reinforced.config,
    );
    expect(reinforcedResult.state.temporaryTerrain[0]).toMatchObject({ remainingRounds: 4 });
    expect(getTerrainCell(reinforcedResult.state.terrain, 2, 2)?.integrity).toBe(1_000);

    const conductive = battleFixture({
      routes: {
        "player:1": [{ moduleId: "main_fold_bridge", routeId: "fold_bridge_conductive" }],
      },
      actorOverrides: { "player:1": { x: 1, y: 3 } },
      definitionOverrides: { terrain },
    });
    const conductiveResult = resolveModuleCommand(
      conductive,
      moduleCommand(conductive, "player:1", "main_fold_bridge", 4, 2),
      conductive.config,
    );
    expect(conductiveResult.state.fieldEffects[0]?.kind).toBe("conductive_bridge");
    expect(() =>
      resolveModuleCommand(
        conductive,
        moduleCommand(conductive, "player:1", "main_fold_bridge", 3, 1),
        conductive.config,
      ),
    ).toThrow("support");
  });

  it("drills a deterministic line with deep and precision route tradeoffs", () => {
    const deep = withRoute("player:2", {
      moduleId: "main_drill_bee",
      routeId: "drill_bee_deep_bore",
    });
    const deepResult = resolveModuleCommand(
      deep,
      moduleCommand(deep, "player:2", "main_drill_bee", 9, 0),
      deep.config,
    );
    expect(deepResult.effects[1]?.magnitude).toBeGreaterThan(0);
    expect(findBattleActor(deepResult.state, "player:2").cooldowns[0]?.remainingRounds).toBe(3);

    const precision = withRoute("player:2", {
      moduleId: "main_drill_bee",
      routeId: "drill_bee_precision",
    });
    const precisionResult = resolveModuleCommand(
      precision,
      moduleCommand(precision, "player:2", "main_drill_bee", 8, 0),
      precision.config,
    );
    expect(precisionResult.state.statistics.directAttacksUsed).toBe(1);
    expect(precisionResult.effects[1]?.details.route).toBe("drill_bee_precision");
  });

  it("pulls metal, task objects, and units with collision consequences", () => {
    const base = battleFixture({
      definitionOverrides: {
        worldObjects: [
          { id: "object:metal", kind: "metal_object", x: 11, y: 1, mass: 100, active: true },
        ],
      },
    });
    const pulled = resolveModuleCommand(
      base,
      moduleCommand(base, "player:3", "main_magnetic_anchor", 11, 1),
      base.config,
    );
    expect(pulled.state.worldObjects[0]).toMatchObject({ x: 9, y: 1 });
    expect(pulled.state.statistics.magneticCollisions).toBe(1);
    expect(findBattleActor(pulled.state, "enemy:1").structuralDamage).toBe(10);

    const precision = battleFixture({
      routes: {
        "player:3": [{ moduleId: "main_magnetic_anchor", routeId: "magnetic_anchor_precision" }],
      },
      definitionOverrides: {
        worldObjects: [
          { id: "object:core", kind: "task_object", x: 12, y: 1, mass: 80, active: true },
        ],
      },
    });
    const precise = resolveModuleCommand(
      precision,
      moduleCommand(precision, "player:3", "main_magnetic_anchor", 12, 1),
      precision.config,
    );
    expect(precise.state.worldObjects[0]).toMatchObject({ x: 11, y: 1 });
    expect(precise.state.statistics.magneticCollisions).toBe(0);
  });

  it.each([
    ["gravity_pin_inversion", 1_000, 2],
    ["gravity_pin_rescue", 400, 3],
  ] as const)("creates gravity field route %s", (routeId, magnitude, duration) => {
    const state = withRoute("enemy:1", { moduleId: "main_gravity_pin", routeId });
    const result = resolveModuleCommand(
      state,
      moduleCommand(state, "enemy:1", "main_gravity_pin", 10, 3, 90_000),
      state.config,
    );
    expect(result.state.fieldEffects[0]).toMatchObject({
      kind: "gravity_field",
      magnitude,
      remainingRounds: duration,
    });
  });

  it.each([
    ["bubble_capsule_rescue", 400, 3],
    ["bubble_capsule_rebound", 900, 2],
  ] as const)("creates bubble route %s", (routeId, magnitude, duration) => {
    const state = withRoute("enemy:2", { moduleId: "main_bubble_capsule", routeId });
    const actor = findBattleActor(state, "enemy:2");
    const result = resolveModuleCommand(
      state,
      moduleCommand(state, actor.id, "main_bubble_capsule", actor.x, actor.y),
      state.config,
    );
    expect(result.state.fieldEffects[0]).toMatchObject({
      kind: "bubble",
      magnitude,
      remainingRounds: duration,
    });
  });

  it("creates sustained and turbine wind fields", () => {
    const sustained = withRoute("enemy:3", {
      moduleId: "main_wind_generator",
      routeId: "wind_generator_sustained",
    });
    const sustainedResult = resolveModuleCommand(
      sustained,
      moduleCommand(sustained, "enemy:3", "main_wind_generator", 16, 3),
      sustained.config,
    );
    expect(sustainedResult.state.fieldEffects[0]).toMatchObject({
      magnitude: 450,
      remainingRounds: 4,
    });

    const turbine = withRoute("enemy:3", {
      moduleId: "main_wind_generator",
      routeId: "wind_generator_turbine",
    });
    const turbineResult = resolveModuleCommand(
      turbine,
      moduleCommand(turbine, "enemy:3", "main_wind_generator", 16, 3),
      turbine.config,
    );
    expect(turbineResult.state.enemyEnergy.current).toBe(10);
    expect(turbineResult.state.energy.current).toBe(12);
  });

  it.each([
    ["support_frame_fortified", 8_000, 4, 10],
    ["support_frame_mobile", 3_000, 1, 11],
  ] as const)("creates support route %s", (routeId, capacity, duration, energy) => {
    const state = withRoute("enemy:4", { moduleId: "main_support_frame", routeId });
    const result = resolveModuleCommand(
      state,
      moduleCommand(state, "enemy:4", "main_support_frame", 19, 0),
      state.config,
    );
    expect(result.state.terrain.supportRoots.at(-1)).toMatchObject({ capacity });
    expect(result.state.temporarySupports[0]?.remainingRounds).toBe(duration);
    expect(result.state.enemyEnergy.current).toBe(energy);
    expect(result.state.energy.current).toBe(12);
  });

  it.each([
    ["energy_rail_accelerator", 1_500, 3],
    ["energy_rail_switchback", 850, 2],
  ] as const)("creates rail route %s", (routeId, magnitude, duration) => {
    const state = withRoute("enemy:5", { moduleId: "main_energy_rail", routeId });
    const result = resolveModuleCommand(
      state,
      moduleCommand(state, "enemy:5", "main_energy_rail", 22, 3, 180_000),
      state.config,
    );
    expect(result.state.fieldEffects[0]).toMatchObject({
      kind: "energy_rail",
      magnitude,
      remainingRounds: duration,
    });
  });
});
