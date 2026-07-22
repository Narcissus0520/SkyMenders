import { describe, expect, it } from "vitest";

import { applyBattleFieldsToProjectile, jammerTargetScoreModifier } from "../src/index.js";
import type { BattleFieldEffect } from "../src/index.js";
import { battleFixture } from "./fixtures.js";

function field(
  id: string,
  kind: BattleFieldEffect["kind"],
  magnitude: number,
  directionMilliDegrees = 0,
): BattleFieldEffect {
  return {
    id,
    kind,
    sourceActorId: "player:1",
    targetActorId: null,
    x: 5,
    y: 5,
    radius: 10,
    directionMilliDegrees,
    magnitude,
    remainingRounds: 2,
    consumed: false,
  };
}

describe("projectile field combinations", () => {
  it("combines gravity, wind, rail redirection, and a one-shot reflector deterministically", () => {
    const state = {
      ...battleFixture(),
      fieldEffects: [
        field("field:a-gravity", "gravity_field", 1_000, 90_000),
        field("field:b-wind", "wind_field", 700, 0),
        field("field:c-rail", "energy_rail", 1_500, 180_000),
        field("field:d-reflector", "reflector", 1, 0),
      ],
    };
    const input = {
      id: "projectile:1",
      sourceActorId: "player:1",
      x: 5,
      y: 5,
      velocityX: 100,
      velocityY: 0,
      power: 100,
      reflectionCount: 0,
    };
    const first = applyBattleFieldsToProjectile(state, input);
    const second = applyBattleFieldsToProjectile(state, input);
    expect(first).toEqual(second);
    expect(first.projectile).toMatchObject({
      velocityX: 352,
      velocityY: 0,
      power: 150,
      reflectionCount: 1,
    });
    expect(
      first.state.fieldEffects.find((candidate) => candidate.id === "field:d-reflector")?.consumed,
    ).toBe(true);
    expect(first.state.statistics.reflectedHits).toBe(1);
  });

  it("supports prismatic reflection, rebound bubbles, conductive gain, and validates projectiles", () => {
    const state = {
      ...battleFixture(),
      fieldEffects: [
        field("field:a-prismatic", "reflector", 2),
        field("field:b-bubble", "bubble", 900),
        field("field:c-bridge", "conductive_bridge", 150),
      ],
    };
    const result = applyBattleFieldsToProjectile(state, {
      id: "projectile:2",
      sourceActorId: "enemy:1",
      x: 5,
      y: 5,
      velocityX: 80,
      velocityY: 20,
      power: 100,
      reflectionCount: 0,
    });
    expect(result.projectile).toMatchObject({
      velocityX: 20,
      velocityY: 80,
      power: 200,
      reflectionCount: 2,
    });
    expect(() =>
      applyBattleFieldsToProjectile(state, {
        id: "projectile:bad",
        sourceActorId: "enemy:1",
        x: 0.5,
        y: 0,
        velocityX: 1,
        velocityY: 1,
        power: 1,
        reflectionCount: 0,
      }),
    ).toThrow("safe integers");
  });

  it("exposes deterministic jammer utility penalties for Phase 4 AI", () => {
    const state = {
      ...battleFixture(),
      fieldEffects: [
        field("field:a-jammer", "jammer", 500),
        { ...field("field:b-jammer", "jammer", 900), x: 20, y: 10, radius: 1 },
      ],
    };
    expect(jammerTargetScoreModifier(state, 5, 5)).toBe(-500);
    expect(jammerTargetScoreModifier(state, 0, 0)).toBe(-500);
    expect(jammerTargetScoreModifier(state, 23, 11)).toBe(0);
  });
});
