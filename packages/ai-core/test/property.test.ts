import { describe, expect, it } from "vitest";

import { assertBattleState } from "@skymenders/battle-core";

import {
  AI_DIFFICULTIES,
  ENEMY_PROTOTYPE_IDS,
  assertAiAuthorityState,
  executeAiEnemyPhase,
} from "../src/index.js";
import { aiFixture } from "./fixtures.js";

describe("AI determinism properties", () => {
  it(
    "keeps legal full-phase decisions identical and bounded across seeded profiles",
    { timeout: 20_000 },
    () => {
      for (let seed = 0; seed < 48; seed += 1) {
        const prototypeId = ENEMY_PROTOTYPE_IDS[seed % ENEMY_PROTOTYPE_IDS.length];
        const difficulty = AI_DIFFICULTIES[seed % AI_DIFFICULTIES.length];
        if (prototypeId === undefined || difficulty === undefined)
          throw new Error("catalog fixture missing");
        const firstFixture = aiFixture([{ prototypeId }], difficulty, seed);
        const secondFixture = aiFixture([{ prototypeId }], difficulty, seed);
        const first = executeAiEnemyPhase(firstFixture.battle, firstFixture.ai, 100);
        const second = executeAiEnemyPhase(secondFixture.battle, secondFixture.ai, 100);
        expect(second).toEqual(first);
        expect(first.commands.length).toBeGreaterThan(0);
        expect(first.commands.length).toBeLessThanOrEqual(4);
        expect(first.commands.every((command) => command.actorId === "enemy:1")).toBe(true);
        expect(first.battleState.energy).toEqual(firstFixture.battle.energy);
        expect(first.battleState.enemyEnergy.current).toBeGreaterThanOrEqual(0);
        assertBattleState(first.battleState);
        assertAiAuthorityState(first.aiState);
      }
    },
  );
});
