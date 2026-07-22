import { hashCanonical } from "@skymenders/deterministic-runtime";
import { describe, expect, it } from "vitest";

import { executeBattleCommands } from "../src/index.js";
import { battleFixture, commandBase, moduleCommand } from "./fixtures.js";

describe("battle rule 0.4 golden replay", () => {
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
      "83b1e4c48d263828",
      "a41e4bd2709a612e",
      "4ed1b5d290519b2e",
      "b8a2f551b273e065",
      "6c23c1c494e513f8",
      "ddb0e97e542642a2",
      "b8338bc68f8150d2",
      "f88515c7bccb2de3",
      "2f1a3d8d2ff8bde1",
      "d78ac59bd54dc92f",
      "979f30915ada70e5",
      "b454a8f995a53e7d",
      "548962a665215902",
    ]);
    expect(hashCanonical(first.finalState)).toBe("548962a665215902");
  });
});
