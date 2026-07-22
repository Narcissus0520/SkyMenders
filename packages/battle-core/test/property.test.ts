import { deriveRngState, nextInteger } from "@skymenders/deterministic-runtime";
import { describe, expect, it } from "vitest";

import { assertBattleState, executeBattleCommands } from "../src/index.js";
import { battleFixture, commandBase } from "./fixtures.js";

describe("seeded battle properties", () => {
  it("keeps whole-round execution deterministic and bounded across generated inputs", () => {
    for (let seed = 0; seed < 128; seed += 1) {
      let rng = deriveRngState(seed, "ai");
      const energySample = nextInteger(rng, 0, 12);
      rng = energySample.state;
      const movementSample = nextInteger(rng, 0, 1);
      const initial = battleFixture({
        actorOverrides: { "player:2": { hp: 80 + (seed % 21) } },
        definitionOverrides: { initialEnergy: energySample.value },
      });
      const firstPlayerCommands =
        movementSample.value === 0
          ? [{ ...commandBase("player:1", 0, `property:${seed}:wait:p1`), kind: "wait" as const }]
          : [
              {
                ...commandBase("player:1", 0, `property:${seed}:move:p1`),
                kind: "move" as const,
                destinationX: 2,
                destinationY: 1,
              },
              { ...commandBase("player:1", 0, `property:${seed}:wait:p1`), kind: "wait" as const },
            ];
      const commands = [
        {
          ...commandBase("system", 0, `property:${seed}:phase:player`),
          kind: "advance_phase" as const,
          expectedPhase: "player_planning" as const,
        },
        ...firstPlayerCommands,
        {
          ...commandBase("player:2", 0, `property:${seed}:repair:p2`),
          kind: "use_basic_action" as const,
          action: "repair" as const,
          targetId: "player:2",
        },
        { ...commandBase("player:3", 0, `property:${seed}:wait:p3`), kind: "wait" as const },
        {
          ...commandBase("system", 0, `property:${seed}:phase:enemy`),
          kind: "advance_phase" as const,
          expectedPhase: "player_action" as const,
        },
        ...[1, 2, 3, 4, 5].map((index) => ({
          ...commandBase(`enemy:${index}`, 0, `property:${seed}:wait:e${index}`),
          kind: "wait" as const,
        })),
        {
          ...commandBase("system", 0, `property:${seed}:phase:environment`),
          kind: "advance_phase" as const,
          expectedPhase: "enemy_action" as const,
        },
        {
          ...commandBase("system", 0, `property:${seed}:phase:settle`),
          kind: "advance_phase" as const,
          expectedPhase: "environment_settlement" as const,
        },
      ];

      const first = executeBattleCommands(initial, commands);
      const second = executeBattleCommands(initial, commands);
      expect(second).toEqual(first);
      expect(() => {
        assertBattleState(first.finalState);
      }).not.toThrow();
      expect(first.finalState.energy.current).toBeGreaterThanOrEqual(0);
      expect(first.finalState.energy.current).toBeLessThanOrEqual(first.finalState.energy.maximum);
      expect(first.finalState.actors.filter((actor) => actor.team === "player")).toHaveLength(3);
      expect(first.events.map((event) => event.sequence)).toEqual(
        first.events.map((_, index) => index),
      );
    }
  }, 15_000);
});
