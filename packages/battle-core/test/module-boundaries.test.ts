import { createTerrainState } from "@skymenders/terrain-core";
import { describe, expect, it } from "vitest";

import { findBattleActor, resolveModuleCommand, terrainIntegrityPermille } from "../src/index.js";
import type { BattleState } from "../src/index.js";
import { battleFixture, moduleCommand } from "./fixtures.js";

function replaceActor(
  state: BattleState,
  actorId: string,
  overrides: Partial<BattleState["actors"][number]>,
): BattleState {
  return {
    ...state,
    actors: state.actors.map((actor) =>
      actor.id === actorId ? { ...actor, ...overrides } : actor,
    ),
  };
}

function bridgeState(): BattleState {
  const terrain = createTerrainState({
    width: 24,
    height: 12,
    fills: [
      { x: 0, y: 0, width: 24, height: 1, materialId: "terrain_alloy_frame" },
      { x: 1, y: 1, width: 1, height: 2, materialId: "terrain_alloy_frame" },
      { x: 6, y: 1, width: 1, height: 2, materialId: "terrain_alloy_frame" },
    ],
    supportRoots: [{ id: "anchor:bridge", kind: "fixed_anchor", x: 0, y: 0, capacity: 100_000 }],
  });
  return battleFixture({
    actorOverrides: { "player:1": { x: 1, y: 3 } },
    definitionOverrides: { terrain },
  });
}

describe("module base mechanics and fail-closed boundaries", () => {
  it("executes every base main-module mechanic", () => {
    const bridge = bridgeState();
    expect(
      resolveModuleCommand(
        bridge,
        moduleCommand(bridge, "player:1", "main_fold_bridge", 5, 2),
        bridge.config,
      ).state.temporaryTerrain[0],
    ).toMatchObject({ remainingRounds: 3 });

    const drill = battleFixture();
    const drilled = resolveModuleCommand(
      drill,
      moduleCommand(drill, "player:2", "main_drill_bee", 5, 0),
      drill.config,
    );
    expect(drilled.effects[1]?.details.route).toBe("base");
    expect(drilled.state.statistics.terrainIntegrityPermille).toBeLessThan(1_000);
    expect(
      terrainIntegrityPermille(
        drilled.state.terrain,
        drilled.state.statistics.terrainInitialIntegrity,
      ),
    ).toBe(drilled.state.statistics.terrainIntegrityPermille);

    const cases = [
      ["enemy:1", "main_gravity_pin", 10, 3, "gravity_field", 700],
      ["enemy:2", "main_bubble_capsule", 13, 1, "bubble", 600],
      ["enemy:3", "main_wind_generator", 16, 3, "wind_field", 700],
      ["enemy:4", "main_support_frame", 19, 0, "support", 5_000],
      ["enemy:5", "main_energy_rail", 22, 3, "energy_rail", 1_200],
    ] as const;
    for (const [actorId, moduleId, x, y, expectedKind, expectedMagnitude] of cases) {
      const state = battleFixture();
      const result = resolveModuleCommand(
        state,
        moduleCommand(state, actorId, moduleId, x, y),
        state.config,
      );
      if (expectedKind === "support") {
        expect(result.state.terrain.supportRoots.at(-1)?.capacity).toBe(expectedMagnitude);
      } else {
        expect(result.state.fieldEffects[0]).toMatchObject({
          kind: expectedKind,
          magnitude: expectedMagnitude,
        });
      }
    }
  });

  it("executes every base auxiliary mechanic", () => {
    const injured = battleFixture({ actorOverrides: { "player:2": { hp: 70 } } });
    expect(
      findBattleActor(
        resolveModuleCommand(
          injured,
          moduleCommand(injured, "player:1", "aux_repair_spray", 4, 1),
          injured.config,
        ).state,
        "player:2",
      ).hp,
    ).toBe(88);

    const fieldCases = [
      ["player:1", "aux_reflector", 2, 2, "reflector", 1],
      ["player:2", "aux_stabilizer", 4, 1, "stabilizer", 500],
      ["player:3", "aux_energy_recycler", 7, 1, "energy_recycler", 1],
      ["enemy:2", "aux_jammer", 13, 3, "jammer", 650],
    ] as const;
    for (const [actorId, moduleId, x, y, kind, magnitude] of fieldCases) {
      const state = battleFixture();
      const result = resolveModuleCommand(
        state,
        moduleCommand(state, actorId, moduleId, x, y),
        state.config,
      );
      expect(result.state.fieldEffects[0]).toMatchObject({ kind, magnitude });
    }

    const ejector = battleFixture();
    expect(
      findBattleActor(
        resolveModuleCommand(
          ejector,
          moduleCommand(ejector, "player:2", "aux_ejector", 4, 1, 90_000),
          ejector.config,
        ).state,
        "player:2",
      ),
    ).toMatchObject({ x: 4, y: 4 });

    const scanner = battleFixture();
    expect(
      resolveModuleCommand(
        scanner,
        moduleCommand(scanner, "player:3", "aux_route_scanner"),
        scanner.config,
      ).state.intel,
    ).toMatchObject({ routeRevealDepth: 3, trajectoryPreviewPermille: 750 });

    const grapple = battleFixture();
    expect(
      findBattleActor(
        resolveModuleCommand(
          grapple,
          moduleCommand(grapple, "enemy:1", "aux_grapple", 12, 1),
          grapple.config,
        ).state,
        "enemy:1",
      ).x,
    ).toBe(12);

    const foam = battleFixture();
    expect(
      resolveModuleCommand(
        foam,
        moduleCommand(foam, "enemy:1", "aux_terrain_foam", 11, 1),
        foam.config,
      ).state.temporaryTerrain[0],
    ).toMatchObject({ remainingRounds: 2 });

    const structure = battleFixture();
    expect(
      resolveModuleCommand(
        structure,
        moduleCommand(structure, "enemy:2", "aux_structure_scanner"),
        structure.config,
      ).state.intel.supportRiskCellIndices,
    ).toEqual([]);
  });

  it("rejects invalid module ownership, action, cooldown, energy, origin, and targets", () => {
    const state = battleFixture();
    const baseCommand = moduleCommand(state, "player:1", "aux_reflector", 2, 2);
    const aimingFault = battleFixture({
      actorOverrides: {
        "player:1": {
          structuralDamage: 35,
          faults: [{ kind: "aiming_fault", source: "magnetic", severity: "minor" }],
        },
      },
    });
    const invalidCases: readonly [BattleState, object, string][] = [
      [state, { ...baseCommand, moduleId: "unknown_module" }, "unknown module"],
      [replaceActor(state, "player:1", { actionEnded: true }), baseCommand, "action ended"],
      [state, { ...baseCommand, moduleId: "aux_ejector" }, "not equipped"],
      [
        replaceActor(state, "player:1", { mainModuleUsed: true }),
        moduleCommand(state, "player:1", "main_fold_bridge", 2, 2),
        "already used",
      ],
      [replaceActor(state, "player:1", { auxiliaryUses: 2 }), baseCommand, "limit reached"],
      [
        replaceActor(state, "player:1", {
          cooldowns: [{ moduleId: "aux_reflector", remainingRounds: 1 }],
        }),
        baseCommand,
        "cooling down",
      ],
      [{ ...state, energy: { ...state.energy, current: 0 } }, baseCommand, "insufficient"],
      [state, { ...baseCommand, originX: 2 }, "origin"],
      [state, { ...baseCommand, targetX: 23, targetY: 11 }, "out of range"],
      [aimingFault, moduleCommand(aimingFault, "player:1", "aux_reflector", 4, 1), "out of range"],
      [state, moduleCommand(state, "player:1", "main_fold_bridge", -1, 1), "inside terrain"],
      [state, moduleCommand(state, "player:1", "aux_reflector"), "requires a target"],
    ];
    for (const [testState, command, message] of invalidCases) {
      expect(() => {
        resolveModuleCommand(testState, command as never, testState.config);
      }).toThrow(message);
    }
  });

  it("rejects illegal mechanic-specific targets", () => {
    const state = battleFixture();
    const bridge = bridgeState();
    const reinforcedSpan = battleFixture({
      routes: {
        "player:1": [{ moduleId: "main_fold_bridge", routeId: "fold_bridge_reinforced" }],
      },
      actorOverrides: { "player:1": { x: 1, y: 3 } },
      definitionOverrides: { terrain: bridge.terrain },
    });
    const nonMagnetic = battleFixture({
      definitionOverrides: {
        worldObjects: [{ id: "object:relic", kind: "relic", x: 9, y: 1, mass: 300, active: true }],
      },
    });
    const adjacentEnemyForEjector = battleFixture({ actorOverrides: { "enemy:1": { x: 5 } } });
    const adjacentEnemyForStabilizer = battleFixture({ actorOverrides: { "enemy:1": { x: 5 } } });
    const adjacentEnemyForRecycler = battleFixture({ actorOverrides: { "enemy:1": { x: 8 } } });
    const adjacentOpponentForBubble = battleFixture({ actorOverrides: { "player:3": { x: 12 } } });
    const unstableGrapple = battleFixture({
      actorOverrides: { "enemy:1": { x: 5 } },
      definitionOverrides: {
        terrain: createTerrainState({
          width: 24,
          height: 12,
          fills: [
            { x: 0, y: 0, width: 1, height: 1, materialId: "terrain_alloy_frame" },
            { x: 2, y: 0, width: 22, height: 1, materialId: "terrain_alloy_frame" },
          ],
          supportRoots: [
            { id: "anchor:isolated", kind: "fixed_anchor", x: 0, y: 0, capacity: 100 },
          ],
        }),
      },
    });
    const illegal: readonly [BattleState, ReturnType<typeof moduleCommand>, string][] = [
      [bridge, moduleCommand(bridge, "player:1", "main_fold_bridge", 1, 2), "gap"],
      [reinforcedSpan, moduleCommand(reinforcedSpan, "player:1", "main_fold_bridge", 5, 2), "span"],
      [state, moduleCommand(state, "player:2", "main_drill_bee", 4, 1), "direction"],
      [state, moduleCommand(state, "player:3", "main_magnetic_anchor", 8, 2), "not found"],
      [
        nonMagnetic,
        moduleCommand(nonMagnetic, "player:3", "main_magnetic_anchor", 9, 1),
        "not magnetically",
      ],
      [
        adjacentOpponentForBubble,
        moduleCommand(adjacentOpponentForBubble, "enemy:2", "main_bubble_capsule", 12, 1),
        "protect allies",
      ],
      [state, moduleCommand(state, "enemy:4", "main_support_frame", 19, 2), "occupied terrain"],
      [
        adjacentEnemyForEjector,
        moduleCommand(adjacentEnemyForEjector, "player:2", "aux_ejector", 5, 1),
        "adjacent ally",
      ],
      [
        adjacentEnemyForStabilizer,
        moduleCommand(adjacentEnemyForStabilizer, "player:2", "aux_stabilizer", 5, 1),
        "target allies",
      ],
      [
        adjacentEnemyForRecycler,
        moduleCommand(adjacentEnemyForRecycler, "player:3", "aux_energy_recycler", 8, 1),
        "target allies",
      ],
      [state, moduleCommand(state, "enemy:1", "aux_grapple", 12, 2), "not standable"],
      [
        unstableGrapple,
        moduleCommand(unstableGrapple, "enemy:1", "aux_grapple", 3, 1),
        "support is unstable",
      ],
      [state, moduleCommand(state, "enemy:1", "aux_terrain_foam", 10, 0), "must be empty"],
    ];
    for (const [testState, command, message] of illegal) {
      expect(() => {
        resolveModuleCommand(testState, command, testState.config);
      }).toThrow(message);
    }
  });

  it("validates deterministic destination occupancy and all cardinal eject directions", () => {
    const state = battleFixture();
    expect(() => {
      resolveModuleCommand(
        state,
        moduleCommand(state, "player:2", "aux_ejector", 4, 1, 0),
        state.config,
      );
    }).toThrow("actor");
    expect(() => {
      resolveModuleCommand(
        state,
        moduleCommand(state, "player:2", "aux_ejector", 4, 1, 270_000),
        state.config,
      );
    }).toThrow("outside terrain");

    const west = battleFixture({ actorOverrides: { "player:1": { x: 2 } } });
    const westResult = resolveModuleCommand(
      west,
      moduleCommand(west, "player:2", "aux_ejector", 4, 1, 180_000),
      west.config,
    );
    expect(findBattleActor(westResult.state, "player:2")).toMatchObject({ x: 1, y: 1 });

    const blockedByObject = battleFixture({
      actorOverrides: { "player:3": { x: 8 } },
      definitionOverrides: {
        worldObjects: [
          { id: "object:block", kind: "metal_object", x: 7, y: 1, mass: 100, active: true },
        ],
      },
    });
    expect(() => {
      resolveModuleCommand(
        blockedByObject,
        moduleCommand(blockedByObject, "player:2", "aux_ejector", 4, 1, 0),
        blockedByObject.config,
      );
    }).toThrow("world object");
  });

  it("consumes overclock recycling once and applies its structural tradeoff", () => {
    let state = battleFixture({
      routes: {
        "player:3": [{ moduleId: "aux_energy_recycler", routeId: "energy_recycler_overclock" }],
      },
    });
    state = resolveModuleCommand(
      state,
      moduleCommand(state, "player:3", "aux_energy_recycler"),
      state.config,
    ).state;
    const result = resolveModuleCommand(
      state,
      moduleCommand(state, "player:3", "main_magnetic_anchor", 11, 2),
      state.config,
    );
    expect(findBattleActor(result.state, "player:3").structuralDamage).toBe(10);
    expect(result.state.fieldEffects[0]?.consumed).toBe(true);
  });

  it("binds module-required objectives to an authoritative entity id and coordinates", () => {
    const state = battleFixture({
      objectives: [
        {
          id: "objective:magnetic",
          role: "primary",
          trigger: "deliver_energy_core",
          progress: 0,
          required: 1,
          status: "active",
          criticalInteraction: false,
          requiredModuleId: "main_magnetic_anchor",
          targetId: "object:metal",
        },
      ],
    });
    const command = {
      ...moduleCommand(state, "player:3", "main_magnetic_anchor", 11, 2),
      targetId: "object:metal",
    };
    const result = resolveModuleCommand(state, command, state.config);
    expect(result.state.objectives[0]).toMatchObject({ progress: 1, status: "completed" });
    expect(result.state.outcome).toEqual({ status: "victory", reason: "primary_completed" });

    expect(() => {
      resolveModuleCommand(state, { ...command, targetId: "object:core" }, state.config);
    }).toThrow("does not match");
    const untargeted = resolveModuleCommand(
      state,
      moduleCommand(state, "player:3", "main_magnetic_anchor", 11, 2),
      state.config,
    );
    expect(untargeted.state.objectives[0]?.progress).toBe(0);
  });
});
