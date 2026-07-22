import { hashCanonical } from "@skymenders/deterministic-runtime";
import { describe, expect, it } from "vitest";

import { executeBattleCommands } from "../src/index.js";
import { battleFixture, commandBase, moduleCommand } from "./fixtures.js";

describe("battle rule 0.3 golden replay", () => {
  it("pins a complete mixed-action round to stable checkpoint and final hashes", () => {
    const initial = battleFixture();
    const commands = [
      {
        ...commandBase("system", 0, "golden:phase:player"),
        kind: "advance_phase",
        expectedPhase: "player_planning",
      },
      {
        ...moduleCommand(initial, "player:1", "aux_reflector", 2, 2, 90_000),
        commandId: "golden:reflector",
      },
      { ...commandBase("player:1", 0, "golden:wait:p1"), kind: "wait" },
      {
        ...moduleCommand(initial, "player:2", "main_drill_bee", 5, 0),
        commandId: "golden:drill",
      },
      {
        ...commandBase("player:3", 0, "golden:interact"),
        kind: "interact",
        targetId: "tower:1",
      },
      {
        ...commandBase("system", 0, "golden:phase:enemy"),
        kind: "advance_phase",
        expectedPhase: "player_action",
      },
      ...[1, 2, 3, 4, 5].map((index) => ({
        ...commandBase(`enemy:${index}`, 0, `golden:wait:e${index}`),
        kind: "wait" as const,
      })),
      {
        ...commandBase("system", 0, "golden:phase:environment"),
        kind: "advance_phase",
        expectedPhase: "enemy_action",
      },
      {
        ...commandBase("system", 0, "golden:phase:settle"),
        kind: "advance_phase",
        expectedPhase: "environment_settlement",
      },
    ];

    const first = executeBattleCommands(initial, commands);
    const second = executeBattleCommands(initial, commands);
    expect(second).toEqual(first);
    expect(first.checkpoints.map((checkpoint) => checkpoint.stateHash)).toEqual([
      "8203836d08abf271",
      "141a0603210dc03f",
      "f1edbe617412aa5d",
      "27a25c0e5aa68322",
      "eeff24e990e7717d",
      "a94bc787d1bdc5fb",
      "be2d4e443c9f0e40",
      "6e88eba16cd1a415",
      "6870446bb3e6edff",
      "9ddbe94df26ddcd9",
      "265bfeb8638d255c",
      "298ffc7d26cc0d79",
      "52314be76f79b183",
    ]);
    expect(hashCanonical(first.finalState)).toBe("52314be76f79b183");
  });
});
