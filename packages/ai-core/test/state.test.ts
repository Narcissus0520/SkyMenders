import { describe, expect, it } from "vitest";

import {
  AI_RULES_VERSION,
  AI_SCHEMA_VERSION,
  assertAiAuthorityState,
  createAiAuthorityState,
  findAiController,
  findBossRuntime,
  replaceBossRuntime,
} from "../src/index.js";

describe("AI authority state", () => {
  it("derives isolated RNG streams and normalizes controllers and bosses", () => {
    const state = createAiAuthorityState({
      rootSeed: 42,
      difficulty: "expert",
      controllers: [
        {
          actorId: "enemy:2",
          prototypeId: null,
          eliteTemplateId: null,
          bossId: "boss_rift_drill",
        },
        {
          actorId: "enemy:1",
          prototypeId: "enemy_scout",
          eliteTemplateId: "elite_stable_scout",
          bossId: null,
        },
      ],
    });
    expect(state.schemaVersion).toBe(AI_SCHEMA_VERSION);
    expect(state.rulesVersion).toBe(AI_RULES_VERSION);
    expect(state.controllers.map((controller) => controller.actorId)).toEqual([
      "enemy:1",
      "enemy:2",
    ]);
    expect(state.aiRngState).not.toEqual(state.aimErrorRngState);
    expect(findAiController(state, "enemy:1").prototypeId).toBe("enemy_scout");
    expect(findBossRuntime(state, "boss_rift_drill").stageHistory).toEqual(["external_drills"]);
    expect(() => findAiController(state, "missing")).toThrow(/not found/);
    expect(() => findBossRuntime(state, "boss_polar_magnetic_tower")).toThrow(/not found/);
  });

  it("rejects ambiguous controllers, mismatched elite templates, and malformed authority state", () => {
    expect(() =>
      createAiAuthorityState({
        rootSeed: 1,
        difficulty: "normal",
        controllers: [
          { actorId: "enemy:1", prototypeId: null, eliteTemplateId: null, bossId: null },
        ],
      }),
    ).toThrow(/exactly one/);
    expect(() =>
      createAiAuthorityState({
        rootSeed: 1,
        difficulty: "normal",
        controllers: [
          {
            actorId: "enemy:1",
            prototypeId: "enemy_guard",
            eliteTemplateId: "elite_stable_scout",
            bossId: null,
          },
        ],
      }),
    ).toThrow(/does not match/);
    const valid = createAiAuthorityState({
      rootSeed: 1,
      difficulty: "normal",
      controllers: [
        {
          actorId: "enemy:1",
          prototypeId: "enemy_scout",
          eliteTemplateId: null,
          bossId: null,
        },
      ],
    });
    expect(() => {
      assertAiAuthorityState({ ...valid, schemaVersion: "9.0.0" });
    }).toThrow(/schema/);
    expect(() => {
      assertAiAuthorityState({ ...valid, rulesVersion: "9.0.0" });
    }).toThrow(/rules/);
    expect(() => {
      assertAiAuthorityState({ ...valid, rootSeed: -1 });
    }).toThrow(/uint32/);
    expect(() => {
      assertAiAuthorityState({ ...valid, decisionIndex: -1 });
    }).toThrow(/decision/);
    expect(() => {
      assertAiAuthorityState({ ...valid, controllers: [] });
    }).toThrow(/controllers/);
  });

  it("replaces only the selected boss runtime", () => {
    const state = createAiAuthorityState({
      rootSeed: 7,
      difficulty: "hard",
      controllers: [
        {
          actorId: "enemy:1",
          prototypeId: null,
          eliteTemplateId: null,
          bossId: "boss_rift_drill",
        },
      ],
    });
    const runtime = findBossRuntime(state, "boss_rift_drill");
    const replaced = replaceBossRuntime(state, { ...runtime, stageProgress: 1 });
    expect(findBossRuntime(replaced, "boss_rift_drill").stageProgress).toBe(1);
    assertAiAuthorityState(replaced);
  });
});
