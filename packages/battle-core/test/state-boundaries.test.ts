import { createTerrainState } from "@skymenders/terrain-core";
import { describe, expect, it } from "vitest";

import {
  assertBattleState,
  createBattleState,
  findBattleActor,
  normalizeBattleRuleConfig,
  terrainIntegrityPermille,
  terrainTotalIntegrity,
} from "../src/index.js";
import type { BattleState } from "../src/index.js";
import { battleFixture } from "./fixtures.js";

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

type StateMutation = (state: Mutable<BattleState>) => void;

function expectInvalid(mutation: StateMutation): void {
  const state = structuredClone(battleFixture()) as Mutable<BattleState>;
  mutation(state);
  expect(() => {
    assertBattleState(state);
  }).toThrow();
}

function actor(state: Mutable<BattleState>, index = 0) {
  const result = state.actors[index];
  if (result === undefined) throw new Error("test actor is missing");
  return result;
}

function objective(state: Mutable<BattleState>, index = 0) {
  const result = state.objectives[index];
  if (result === undefined) throw new Error("test objective is missing");
  return result;
}

function worldObject(state: Mutable<BattleState>, index = 0) {
  const result = state.worldObjects[index];
  if (result === undefined) throw new Error("test world object is missing");
  return result;
}

describe("battle state boundary validation", () => {
  it("accepts populated optional state and preserves the original terrain baseline", () => {
    const base = battleFixture({
      actorOverrides: {
        "player:1": {
          structuralDamage: 30,
          faults: [{ kind: "aiming_fault", source: "magnetic", severity: "minor" }],
          carriedObjectId: "object:core",
          cooldowns: [{ moduleId: "aux_reflector", remainingRounds: 1 }],
          selectedRoutes: [
            { moduleId: "aux_reflector", routeId: "reflector_prismatic" },
            { moduleId: "main_fold_bridge", routeId: "fold_bridge_reinforced" },
          ],
        },
      },
    });
    const state: BattleState = {
      ...base,
      fieldEffects: [
        {
          id: "effect:wind",
          kind: "wind_field",
          sourceActorId: "player:1",
          targetActorId: "enemy:1",
          x: 2,
          y: 2,
          radius: 2,
          directionMilliDegrees: 359_999,
          magnitude: 1,
          remainingRounds: 1,
          consumed: false,
        },
      ],
      temporarySupports: [
        { effectId: "support:effect", rootId: "support:root", remainingRounds: 1 },
      ],
      temporaryTerrain: [
        { effectId: "terrain:effect", cells: [{ x: 3, y: 2 }], remainingRounds: 1 },
      ],
      intel: {
        ...base.intel,
        hiddenTargetIds: ["hidden:a", "hidden:b"],
        supportRiskCellIndices: [1, 2],
      },
    };

    expect(() => {
      assertBattleState(state);
    }).not.toThrow();
    expect(findBattleActor(state, "player:1").selectedRoutes.map((item) => item.moduleId)).toEqual([
      "aux_reflector",
      "main_fold_bridge",
    ]);
    expect(state.statistics.terrainInitialIntegrity).toBe(24_000);
    expect(terrainIntegrityPermille(state.terrain, state.statistics.terrainInitialIntegrity)).toBe(
      1_000,
    );
  });

  it("rejects invalid envelope, collection, energy, and intel bounds", () => {
    const mutations: readonly StateMutation[] = [
      (state) => {
        state.battleSchemaVersion = "9.9.9";
      },
      (state) => {
        state.battleId = "bad id";
      },
      (state) => {
        state.turnIndex = -1;
      },
      (state) => {
        state.nextEventSequence = 0.5;
      },
      (state) => {
        state.actors = [];
      },
      (state) => {
        state.actors = Array.from({ length: 65 }, (_, index) => ({
          ...actor(state),
          id: `neutral:${index}`,
          team: index < 3 ? "player" : "neutral",
          x: index % 24,
        }));
      },
      (state) => {
        state.actors[1] = { ...actor(state), x: 4 };
      },
      (state) => {
        state.objectives = [];
      },
      (state) => {
        state.objectives = Array.from({ length: 4 }, (_, index) => ({
          ...objective(state),
          id: `objective:${index}`,
        }));
      },
      (state) => {
        state.objectives.push({ ...objective(state), id: "objective:secondary", role: "primary" });
      },
      (state) => {
        state.worldObjects[1] = { ...worldObject(state), x: 14 };
      },
      (state) => {
        actor(state, 1).x = actor(state).x;
        actor(state, 1).y = actor(state).y;
      },
      (state) => {
        worldObject(state).x = actor(state).x;
        worldObject(state).y = actor(state).y;
      },
      (state) => {
        actor(state).y = 0;
      },
      (state) => {
        state.energy.current = state.energy.maximum + 1;
      },
      (state) => {
        state.energy.maximum = 0;
      },
      (state) => {
        state.energy.regenerationPerRound = state.energy.maximum + 1;
      },
      (state) => {
        state.energy.waitEnergyGrantedThisRound = state.energy.maximumWaitEnergyPerRound + 1;
      },
      (state) => {
        state.energy.waitGain = state.config.waitGain + 1;
      },
      (state) => {
        state.config.maximumEnergy = 1_001;
        state.energy.maximum = 1_001;
      },
      (state) => {
        state.intel.hiddenTargetIds = ["hidden:b", "hidden:a"];
      },
      (state) => {
        state.intel.hiddenTargetIds = ["hidden:a", "hidden:a"];
      },
      (state) => {
        state.intel.supportRiskCellIndices = [2, 1];
      },
      (state) => {
        state.intel.supportRiskCellIndices = [-1];
      },
      (state) => {
        state.intel.trajectoryPreviewPermille = 1_001;
      },
      (state) => {
        state.statistics.directAttacksUsed = -1;
      },
      (state) => {
        state.statistics.terrainIntegrityPermille = 1_001;
      },
      (state) => {
        state.phase = "battle_complete";
      },
      (state) => {
        state.phase = "battle_complete";
        state.outcome = { status: "victory", reason: "none" };
      },
      (state) => {
        state.phase = "battle_complete";
        state.outcome = { status: "victory", reason: "team_disabled" };
      },
      (state) => {
        state.phase = "battle_complete";
        state.outcome = { status: "defeat", reason: "primary_completed" };
      },
      (state) => {
        state.outcome = { status: "ongoing", reason: "primary_failed" };
      },
    ];
    for (const mutation of mutations) expectInvalid(mutation);
  });

  it("rejects invalid actors, objectives, objects, and transient effects", () => {
    const mutations: readonly StateMutation[] = [
      (state) => {
        actor(state).id = "?";
      },
      (state) => {
        actor(state).x = 24;
      },
      (state) => {
        actor(state).maxHp = 0;
      },
      (state) => {
        actor(state).structuralDamage = 101;
      },
      (state) => {
        actor(state).hp = 0;
        actor(state).disabled = true;
      },
      (state) => {
        actor(state).recoveryBeaconId = "beacon:orphan";
      },
      (state) => {
        actor(state).carriedObjectId = "bad id";
      },
      (state) => {
        actor(state).structuralDamage = 60;
        actor(state).faults = [
          { kind: "aiming_fault", source: "magnetic", severity: "major" },
          { kind: "aiming_fault", source: "magnetic", severity: "minor" },
        ];
      },
      (state) => {
        actor(state).faults = [{ kind: "aiming_fault", source: "magnetic", severity: "minor" }];
      },
      (state) => {
        actor(state).structuralDamage = 35;
        actor(state).faults = [];
      },
      (state) => {
        actor(state).structuralDamage = 35;
        actor(state).faults = [{ kind: "mobility_fault", source: "magnetic", severity: "minor" }];
      },
      (state) => {
        actor(state).structuralDamage = 35;
        actor(state).faults = [{ kind: "aiming_fault", source: "magnetic", severity: "major" }];
      },
      (state) => {
        actor(state).auxiliaryUses = 3;
      },
      (state) => {
        state.config.maximumAuxiliaryUsesPerActor = 1;
        actor(state).auxiliaryUses = 2;
      },
      (state) => {
        actor(state).auxiliaryModuleIds = ["aux_reflector", "aux_reflector"];
      },
      (state) => {
        actor(state).cooldowns = [
          { moduleId: "aux_reflector", remainingRounds: 1 },
          { moduleId: "aux_reflector", remainingRounds: 2 },
        ];
      },
      (state) => {
        actor(state).cooldowns = [{ moduleId: "aux_reflector", remainingRounds: -1 }];
      },
      (state) => {
        actor(state).selectedRoutes = [
          { moduleId: "main_fold_bridge", routeId: "reflector_prismatic" },
        ];
      },
      (state) => {
        objective(state).required = 0;
      },
      (state) => {
        objective(state).progress = 3;
      },
      (state) => {
        objective(state).progress = 2;
      },
      (state) => {
        objective(state).requiredModuleId = "unknown_module" as never;
      },
      (state) => {
        objective(state).targetId = "bad id";
      },
      (state) => {
        worldObject(state).mass = 0;
      },
      (state) => {
        worldObject(state).mass = 1_001;
      },
      (state) => {
        worldObject(state).y = -1;
      },
      (state) => {
        state.fieldEffects = Array.from({ length: 257 }, (_, index) => ({
          id: `effect:${index}`,
          kind: "wind_field",
          sourceActorId: "player:1",
          targetActorId: null,
          x: 2,
          y: 2,
          radius: 1,
          directionMilliDegrees: 0,
          magnitude: 1,
          remainingRounds: 1,
          consumed: false,
        }));
      },
      (state) => {
        state.fieldEffects = [
          {
            id: "effect:bad",
            kind: "wind_field",
            sourceActorId: "player:1",
            targetActorId: "bad id",
            x: 2,
            y: 2,
            radius: 1,
            directionMilliDegrees: 360_000,
            magnitude: 1,
            remainingRounds: 1,
            consumed: false,
          },
        ];
      },
      (state) => {
        state.temporarySupports = [
          { effectId: "bad id", rootId: "support:root", remainingRounds: 1 },
        ];
      },
      (state) => {
        state.temporaryTerrain = [{ effectId: "terrain:empty", cells: [], remainingRounds: 1 }];
      },
      (state) => {
        state.temporaryTerrain = [
          {
            effectId: "terrain:duplicate",
            cells: [
              { x: 2, y: 2 },
              { x: 2, y: 2 },
            ],
            remainingRounds: 1,
          },
        ];
      },
    ];
    for (const mutation of mutations) expectInvalid(mutation);
  });

  it("validates configuration extremes and empty terrain integrity", () => {
    expect(() => normalizeBattleRuleConfig({ maximumMoveDistance: 0 })).toThrow();
    expect(() => normalizeBattleRuleConfig({ maximumAuxiliaryUsesPerActor: 3 })).toThrow();
    expect(() => normalizeBattleRuleConfig({ survivorRecoveryPermille: 1_001 })).toThrow();
    expect(() => normalizeBattleRuleConfig({ disabledRecoveryPermille: 1_001 })).toThrow();
    expect(() => normalizeBattleRuleConfig({ waitGain: -1 })).toThrow();
    expect(() => findBattleActor(battleFixture(), "missing:actor")).toThrow("not found");

    const base = battleFixture();
    const emptyTerrain = createTerrainState({ width: 24, height: 12 });
    const empty = createBattleState({
      battleId: "battle:empty-terrain",
      terrain: emptyTerrain,
      actors: base.actors,
      objectives: base.objectives,
    });
    expect(terrainTotalIntegrity(empty.terrain)).toBe(0);
    expect(terrainIntegrityPermille(empty.terrain)).toBe(0);
  });
});
