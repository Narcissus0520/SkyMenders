import { describe, expect, it } from "vitest";

import {
  actorTeamEnergy,
  advanceBattlePhase,
  reduceBattleCommand,
  replaceActorTeamEnergy,
} from "../src/index.js";
import { battleFixture, commandBase, moduleCommand } from "./fixtures.js";

describe("separate team energy authority", () => {
  it("charges enemy modules only to the enemy energy pool", () => {
    const state = {
      ...battleFixture(),
      phase: "enemy_action" as const,
      energy: { ...battleFixture().energy, current: 7 },
      enemyEnergy: { ...battleFixture().enemyEnergy, current: 9 },
    };
    const result = reduceBattleCommand(
      state,
      moduleCommand(state, "enemy:1", "main_gravity_pin", 10, 3),
      0,
    );
    expect(result.state.energy.current).toBe(7);
    expect(result.state.enemyEnergy.current).toBe(4);
  });

  it("grants wait and round regeneration independently per team", () => {
    const fixture = battleFixture();
    const enemyTurn = {
      ...fixture,
      phase: "enemy_action" as const,
      energy: { ...fixture.energy, current: 2 },
      enemyEnergy: { ...fixture.enemyEnergy, current: 1 },
    };
    const waited = reduceBattleCommand(
      enemyTurn,
      { ...commandBase("enemy:1"), kind: "wait" },
      0,
    ).state;
    expect(waited.energy.current).toBe(2);
    expect(waited.enemyEnergy.current).toBe(2);

    const settlement = {
      ...waited,
      phase: "environment_settlement" as const,
      actors: waited.actors.map((actor) => ({ ...actor, actionEnded: true })),
    };
    const result = advanceBattlePhase(settlement);
    expect(result.state.energy.current).toBe(8);
    expect(result.state.enemyEnergy.current).toBe(8);
    expect(
      result.effects.filter(
        (effect) =>
          effect.kind === "energy_changed" && effect.details.reason === "round_regeneration",
      ),
    ).toHaveLength(2);
  });

  it("rejects neutral energy ownership", () => {
    const state = battleFixture();
    expect(() => actorTeamEnergy(state, "neutral")).toThrow(/neutral/);
    expect(() => replaceActorTeamEnergy(state, "neutral", state.energy)).toThrow(/neutral/);
  });
});
