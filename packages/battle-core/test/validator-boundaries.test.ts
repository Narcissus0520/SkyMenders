import { describe, expect, it } from "vitest";

import { validateBattleDefinition } from "../src/index.js";
import type { CreateBattleDefinition } from "../src/index.js";
import { battleFixture } from "./fixtures.js";

function definition(overrides: Partial<CreateBattleDefinition> = {}): CreateBattleDefinition {
  const state = battleFixture();
  return {
    battleId: state.battleId,
    terrain: state.terrain,
    actors: state.actors,
    objectives: state.objectives,
    worldObjects: state.worldObjects,
    ...overrides,
  };
}

function primaryObjective(state: ReturnType<typeof battleFixture>) {
  const objective = state.objectives[0];
  if (objective === undefined) throw new Error("fixture primary objective is missing");
  return objective;
}

describe("battle content validation boundaries", () => {
  it("reports malformed state definitions without throwing", () => {
    const state = battleFixture();
    const report = validateBattleDefinition(
      definition({ actors: state.actors.filter((actor) => actor.id !== "player:3") }),
    );
    expect(report.valid).toBe(false);
    expect(report.issues).toEqual([
      expect.objectContaining({ code: "BATTLE_STATE_INVALID", path: "battle" }),
    ]);
  });

  it("requires both zero-energy fallback actions", () => {
    const report = validateBattleDefinition(
      definition({ config: { basicRepairHp: 0, basicPushDistance: 0 } }),
    );
    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain("FALLBACK_ACTION_MISSING");
  });

  it("rejects ambiguous or untargeted critical interactions", () => {
    const state = battleFixture();
    const report = validateBattleDefinition(
      definition({
        objectives: [
          {
            ...primaryObjective(state),
            criticalInteraction: true,
            requiredModuleId: "main_fold_bridge",
            targetId: null,
          },
        ],
      }),
    );
    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "OBJECTIVE_INTERACTION_AMBIGUOUS",
      "OBJECTIVE_TARGET_MISSING",
    ]);
  });

  it("rejects unequipped objective modules and globally unaffordable loadouts", () => {
    const state = battleFixture();
    const actorsWithoutRail = state.actors.map((actor) =>
      actor.id === "enemy:5" ? { ...actor, mainModuleId: "main_fold_bridge" as const } : actor,
    );
    const unequipped = validateBattleDefinition(
      definition({
        actors: actorsWithoutRail,
        objectives: [
          {
            ...primaryObjective(state),
            criticalInteraction: false,
            requiredModuleId: "main_energy_rail",
          },
        ],
      }),
    );
    expect(unequipped.issues.map((issue) => issue.code)).toContain("OBJECTIVE_MODULE_UNEQUIPPED");

    const unaffordable = validateBattleDefinition(
      definition({
        initialEnergy: 1,
        config: { maximumEnergy: 1, regenerationPerRound: 1 },
      }),
    );
    expect(unaffordable.valid).toBe(false);
    const unusableCount = unaffordable.issues.filter(
      (issue) => issue.code === "MODULE_ENERGY_UNUSABLE",
    ).length;
    expect(unusableCount).toBeGreaterThan(0);
    expect(unusableCount).toBeLessThan(state.actors.length * 3);
    expect(unaffordable.issues).toEqual(
      [...unaffordable.issues].sort(
        (left, right) =>
          left.code.localeCompare(right.code) ||
          left.path.localeCompare(right.path) ||
          left.message.localeCompare(right.message),
      ),
    );
  });
});
