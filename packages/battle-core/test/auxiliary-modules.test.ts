import { createTerrainState, getTerrainCell } from "@skymenders/terrain-core";
import { describe, expect, it } from "vitest";

import { findBattleActor, resolveModuleCommand } from "../src/index.js";
import type { ModuleRouteSelection } from "../src/index.js";
import { battleFixture, moduleCommand } from "./fixtures.js";

function withRoute(actorId: string, selection: ModuleRouteSelection) {
  return battleFixture({ routes: { [actorId]: [selection] } });
}

describe("ten auxiliary module mechanics", () => {
  it("repairs units or terrain with route-specific specialization", () => {
    const unit = battleFixture({
      routes: {
        "player:1": [{ moduleId: "aux_repair_spray", routeId: "repair_spray_unit_specialist" }],
      },
      actorOverrides: { "player:2": { hp: 60 } },
    });
    const repairedUnit = resolveModuleCommand(
      unit,
      moduleCommand(unit, "player:1", "aux_repair_spray", 4, 1),
      unit.config,
    );
    expect(findBattleActor(repairedUnit.state, "player:2").hp).toBe(90);

    const terrain = withRoute("player:1", {
      moduleId: "aux_repair_spray",
      routeId: "repair_spray_terrain_specialist",
    });
    const repairedTerrain = resolveModuleCommand(
      terrain,
      moduleCommand(terrain, "player:1", "aux_repair_spray", 2, 1),
      terrain.config,
    );
    expect(getTerrainCell(repairedTerrain.state.terrain, 2, 1)).toMatchObject({
      materialId: "terrain_cloud_soil",
      integrity: 600,
    });
  });

  it.each([
    ["reflector_prismatic", 2, 1],
    ["reflector_wide_guard", 1, 3],
  ] as const)("creates reflector route %s", (routeId, magnitude, radius) => {
    const state = withRoute("player:1", { moduleId: "aux_reflector", routeId });
    const result = resolveModuleCommand(
      state,
      moduleCommand(state, "player:1", "aux_reflector", 2, 2, 90_000),
      state.config,
    );
    expect(result.state.fieldEffects[0]).toMatchObject({ kind: "reflector", magnitude, radius });
  });

  it("ejects one or two allies with route-specific range", () => {
    const tandem = battleFixture({
      routes: { "player:2": [{ moduleId: "aux_ejector", routeId: "ejector_tandem" }] },
      actorOverrides: { "player:1": { x: 3 } },
    });
    const tandemResult = resolveModuleCommand(
      tandem,
      moduleCommand(tandem, "player:2", "aux_ejector", 4, 1, 90_000),
      tandem.config,
    );
    expect(findBattleActor(tandemResult.state, "player:2")).toMatchObject({ x: 4, y: 4 });
    expect(findBattleActor(tandemResult.state, "player:1")).toMatchObject({ x: 4, y: 3 });

    const longBurn = withRoute("player:2", {
      moduleId: "aux_ejector",
      routeId: "ejector_long_burn",
    });
    const longResult = resolveModuleCommand(
      longBurn,
      moduleCommand(longBurn, "player:2", "aux_ejector", 4, 1, 90_000),
      longBurn.config,
    );
    expect(findBattleActor(longResult.state, "player:2")).toMatchObject({ y: 6 });
  });

  it.each([
    ["stabilizer_anchor", 800, 3],
    ["stabilizer_counterforce", 600, 2],
  ] as const)("creates stabilizer route %s", (routeId, magnitude, duration) => {
    const state = withRoute("player:2", { moduleId: "aux_stabilizer", routeId });
    const actor = findBattleActor(state, "player:2");
    const result = resolveModuleCommand(
      state,
      moduleCommand(state, actor.id, "aux_stabilizer", actor.x, actor.y),
      state.config,
    );
    expect(result.state.fieldEffects[0]).toMatchObject({ magnitude, remainingRounds: duration });
  });

  it.each([
    ["route_scanner_deep_intel", 4, 750],
    ["route_scanner_ballistic", 3, 1_000],
  ] as const)("reveals route and ballistic information via %s", (routeId, depth, trajectory) => {
    const state = withRoute("player:3", { moduleId: "aux_route_scanner", routeId });
    const result = resolveModuleCommand(
      state,
      moduleCommand(state, "player:3", "aux_route_scanner", 7, 2),
      state.config,
    );
    expect(result.state.intel).toMatchObject({
      routeRevealDepth: depth,
      trajectoryPreviewPermille: trajectory,
    });
  });

  it("installs base, team, and overclock recyclers and consumes a refund once", () => {
    let state = battleFixture();
    state = resolveModuleCommand(
      state,
      moduleCommand(state, "player:3", "aux_energy_recycler", 7, 1),
      state.config,
    ).state;
    expect(state.fieldEffects[0]?.magnitude).toBe(1);
    state = resolveModuleCommand(
      state,
      moduleCommand(state, "player:3", "main_magnetic_anchor", 11, 2),
      state.config,
    ).state;
    expect(state.energy.current).toBe(9);
    expect(state.fieldEffects[0]?.consumed).toBe(true);

    const team = battleFixture({
      routes: {
        "player:3": [{ moduleId: "aux_energy_recycler", routeId: "energy_recycler_team_loop" }],
      },
      actorOverrides: { "player:2": { x: 6 } },
    });
    const teamResult = resolveModuleCommand(
      team,
      moduleCommand(team, "player:3", "aux_energy_recycler", 6, 1),
      team.config,
    );
    expect(teamResult.state.fieldEffects[0]).toMatchObject({
      targetActorId: "player:2",
      magnitude: 2,
    });

    const overclock = withRoute("player:3", {
      moduleId: "aux_energy_recycler",
      routeId: "energy_recycler_overclock",
    });
    const overclockResult = resolveModuleCommand(
      overclock,
      moduleCommand(overclock, "player:3", "aux_energy_recycler", 7, 1),
      overclock.config,
    );
    expect(overclockResult.state.fieldEffects[0]?.magnitude).toBe(3);
    expect(overclockResult.state.energy.current).toBe(10);
  });

  it("grapples self, rescues an adjacent ally, and supports a long slingshot", () => {
    const rescue = battleFixture({
      routes: { "enemy:1": [{ moduleId: "aux_grapple", routeId: "grapple_rescue_line" }] },
      actorOverrides: { "enemy:2": { x: 11 } },
    });
    const rescueResult = resolveModuleCommand(
      rescue,
      moduleCommand(rescue, "enemy:1", "aux_grapple", 12, 1),
      rescue.config,
    );
    expect(findBattleActor(rescueResult.state, "enemy:1")).toMatchObject({ x: 12, y: 1 });
    expect(findBattleActor(rescueResult.state, "enemy:2")).toMatchObject({ x: 10, y: 1 });

    const slingshot = withRoute("enemy:1", {
      moduleId: "aux_grapple",
      routeId: "grapple_slingshot",
    });
    const slingResult = resolveModuleCommand(
      slingshot,
      moduleCommand(slingshot, "enemy:1", "aux_grapple", 17, 1),
      slingshot.config,
    );
    expect(findBattleActor(slingResult.state, "enemy:1").x).toBe(17);
  });

  it.each([
    ["terrain_foam_reinforced", "terrain_cloud_soil", 800, 3],
    ["terrain_foam_elastic", "terrain_elastic_moss", 450, 2],
  ] as const)("fills a temporary gap via %s", (routeId, materialId, integrity, duration) => {
    const state = withRoute("enemy:1", { moduleId: "aux_terrain_foam", routeId });
    const result = resolveModuleCommand(
      state,
      moduleCommand(state, "enemy:1", "aux_terrain_foam", 11, 1),
      state.config,
    );
    expect(getTerrainCell(result.state.terrain, 11, 1)).toMatchObject({ materialId, integrity });
    expect(result.state.temporaryTerrain[0]?.remainingRounds).toBe(duration);
  });

  it.each([
    ["jammer_decoy", 500, 5, 3],
    ["jammer_silence", 900, 3, 2],
  ] as const)("creates jammer route %s", (routeId, magnitude, radius, duration) => {
    const state = withRoute("enemy:2", { moduleId: "aux_jammer", routeId });
    const result = resolveModuleCommand(
      state,
      moduleCommand(state, "enemy:2", "aux_jammer", 13, 3),
      state.config,
    );
    expect(result.state.fieldEffects[0]).toMatchObject({
      magnitude,
      radius,
      remainingRounds: duration,
    });
  });

  it("scans collapse risk with predictive and salvage routes", () => {
    const terrain = createTerrainState({
      width: 24,
      height: 12,
      fills: [
        { x: 0, y: 0, width: 24, height: 1, materialId: "terrain_alloy_frame" },
        { x: 5, y: 5, width: 2, height: 1, materialId: "terrain_cloud_soil" },
      ],
      supportRoots: [{ id: "anchor:scan", kind: "fixed_anchor", x: 0, y: 0, capacity: 100_000 }],
    });
    const predictive = battleFixture({
      routes: {
        "enemy:2": [{ moduleId: "aux_structure_scanner", routeId: "structure_scanner_predictive" }],
      },
      definitionOverrides: { terrain },
    });
    const predicted = resolveModuleCommand(
      predictive,
      moduleCommand(predictive, "enemy:2", "aux_structure_scanner", 13, 3),
      predictive.config,
    );
    expect(predicted.state.intel.supportRiskCellIndices).toHaveLength(2);
    expect(predicted.state.intel.trajectoryPreviewPermille).toBe(900);

    const salvage = battleFixture({
      routes: {
        "enemy:2": [{ moduleId: "aux_structure_scanner", routeId: "structure_scanner_salvage" }],
      },
      definitionOverrides: { terrain },
    });
    const salvaged = resolveModuleCommand(
      salvage,
      moduleCommand(salvage, "enemy:2", "aux_structure_scanner", 13, 3),
      salvage.config,
    );
    expect(salvaged.state.energy.current).toBe(12);
  });
});
