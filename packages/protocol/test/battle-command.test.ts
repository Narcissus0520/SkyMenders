import { describe, expect, it } from "vitest";

import { battleCommandSchema, parseBattleCommand, parseReplayFile } from "../src/index.js";

const base = { commandId: "cmd:1", battleId: "battle:1", turnIndex: 0, actorId: "robot:1" };

describe("battle command protocol", () => {
  it.each([
    { ...base, kind: "move", destinationX: 1_000, destinationY: -2_000 },
    {
      ...base,
      kind: "use_module",
      moduleId: "main_fold_bridge",
      originX: 0,
      originY: 1_000,
      angleMilliDegrees: 45_000,
      powerPermille: 750,
      targetX: 2_000,
      targetY: 3_000,
    },
    { ...base, kind: "wait" },
    { ...base, kind: "interact", targetId: "objective:1" },
  ])("parses $kind commands", (command) => {
    expect(parseBattleCommand(command)).toEqual(command);
  });

  it.each([
    { ...base, kind: "move", destinationX: 1.5, destinationY: 0 },
    {
      ...base,
      kind: "use_module",
      moduleId: "main_fold_bridge",
      originX: 0,
      originY: 0,
      angleMilliDegrees: 360_000,
      powerPermille: 500,
    },
    { ...base, kind: "wait", injected: true },
    { ...base, kind: "unknown" },
  ])("rejects malformed commands", (command) => {
    expect(battleCommandSchema.safeParse(command).success).toBe(false);
  });
});

describe("replay file protocol", () => {
  it("parses a bounded versioned replay", () => {
    const replay = {
      replaySchemaVersion: "0.1.0",
      rulesVersion: "0.1.0",
      contentVersion: "0.0.0",
      fixtureId: "runtime:1",
      rootSeed: 123,
      initialState: { value: 0 },
      commands: [{ ...base, kind: "wait" }],
      expectedCheckpoints: [{ commandIndex: 0, stateHash: "0123456789abcdef" }],
      expectedFinalHash: "0123456789abcdef",
    };
    expect(parseReplayFile(replay)).toEqual(replay);
  });

  it("rejects non-JSON initial state and out-of-range seeds", () => {
    expect(() =>
      parseReplayFile({
        replaySchemaVersion: "0.1.0",
        rulesVersion: "0.1.0",
        contentVersion: "0.0.0",
        fixtureId: "runtime:1",
        rootSeed: 0x1_0000_0000,
        initialState: { value: undefined },
        commands: [],
        expectedCheckpoints: [],
        expectedFinalHash: "0123456789abcdef",
      }),
    ).toThrow();
  });
});
