import { describe, expect, it } from "vitest";

import {
  BATTLE_RULES_VERSION,
  DEFAULT_BATTLE_RULE_CONFIG,
  assertBattleState,
  createBattleState,
  effectiveModuleCooldown,
  effectiveModuleEnergyCost,
  effectiveMoveDistance,
  findBattleActor,
  normalizeBattleRuleConfig,
  validateBattleDefinition,
} from "../src/index.js";
import { battleFixture } from "./fixtures.js";

describe("battle state and definition validation", () => {
  it("creates a bounded three-robot battle with configurable shared energy", () => {
    const state = battleFixture({ definitionOverrides: { initialEnergy: 8 } });
    expect(state.rulesVersion).toBe(BATTLE_RULES_VERSION);
    expect(state.phase).toBe("player_planning");
    expect(state.energy).toMatchObject({ current: 8, maximum: 12, regenerationPerRound: 6 });
    expect(state.actors.filter((actor) => actor.team === "player")).toHaveLength(3);
    expect(state.statistics.terrainIntegrityPermille).toBe(1_000);
    expect(() => {
      assertBattleState(state);
    }).not.toThrow();
  });

  it("applies structural fault penalties without disabling fallback movement", () => {
    const state = battleFixture({
      actorOverrides: {
        "player:1": {
          structuralDamage: 60,
          faults: [
            { kind: "mobility_fault", source: "fall", severity: "major" },
            { kind: "cooling_fault", source: "overload", severity: "major" },
          ],
        },
      },
    });
    const actor = findBattleActor(state, "player:1");
    expect(effectiveMoveDistance(actor, state.config)).toBe(3);
    expect(effectiveModuleEnergyCost(actor, "main_fold_bridge")).toBe(4);
    expect(effectiveModuleCooldown(actor, "main_fold_bridge")).toBe(2);
  });

  it("rejects inconsistent durability, objectives, and configuration", () => {
    const state = battleFixture();
    expect(() => {
      assertBattleState({ ...state, rulesVersion: "9.9.9" });
    }).toThrow("unsupported battle rules");
    expect(() => {
      assertBattleState({
        ...state,
        actors: state.actors.map((actor, index) =>
          index === 0 ? { ...actor, hp: 0, disabled: false } : actor,
        ),
      });
    }).toThrow("disabled state");
    expect(() => {
      normalizeBattleRuleConfig({ maximumEnergy: 4, regenerationPerRound: 5 });
    }).toThrow();
    expect(() => {
      createBattleState({
        battleId: "battle:bad",
        terrain: state.terrain,
        actors: state.actors.filter((actor) => actor.id !== "player:3"),
        objectives: state.objectives,
      });
    }).toThrow("exactly three");
  });

  it("detects required-module energy deadlocks while critical interaction stays free", () => {
    const deadlocked = battleFixture({
      actorOverrides: {
        "player:1": {
          mainModuleId: "main_gravity_pin",
          structuralDamage: 30,
          faults: [{ kind: "cooling_fault", source: "overload", severity: "minor" }],
        },
      },
      objectives: [
        {
          id: "objective:primary",
          role: "primary",
          trigger: "close_pollution_node",
          progress: 0,
          required: 1,
          status: "active",
          criticalInteraction: false,
          requiredModuleId: "main_gravity_pin",
          targetId: "node:1",
        },
      ],
      definitionOverrides: {
        config: { maximumEnergy: 5, regenerationPerRound: 5 },
        initialEnergy: 5,
      },
    });
    const report = validateBattleDefinition({
      battleId: deadlocked.battleId,
      terrain: deadlocked.terrain,
      actors: deadlocked.actors,
      objectives: deadlocked.objectives,
      worldObjects: deadlocked.worldObjects,
      config: deadlocked.config,
      initialEnergy: deadlocked.energy.current,
      initialEnemyEnergy: deadlocked.enemyEnergy.current,
    });
    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain("OBJECTIVE_ENERGY_DEADLOCK");

    const valid = battleFixture();
    expect(
      validateBattleDefinition({
        battleId: valid.battleId,
        terrain: valid.terrain,
        actors: valid.actors,
        objectives: valid.objectives,
        worldObjects: valid.worldObjects,
        config: DEFAULT_BATTLE_RULE_CONFIG,
      }).valid,
    ).toBe(true);
  });
});
