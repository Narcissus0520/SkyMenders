import { describe, expect, it } from "vitest";

import { battleEventSchema, parseBattleEvent } from "../src/index.js";

const base = { battleId: "battle:1", sequence: 0, turnIndex: 0 };

describe("battle event protocol", () => {
  it.each([
    { ...base, kind: "command_accepted", commandId: "cmd:1", actorId: "robot:1" },
    {
      ...base,
      kind: "actor_moved",
      commandId: "cmd:1",
      actorId: "robot:1",
      fromX: 0,
      fromY: 0,
      toX: 1_000,
      toY: 2_000,
    },
    {
      ...base,
      kind: "module_resolved",
      commandId: "cmd:1",
      actorId: "robot:1",
      moduleId: "main_fold_bridge",
      resolutionHash: "0123456789abcdef",
    },
    { ...base, kind: "turn_waited", commandId: "cmd:1", actorId: "robot:1" },
    {
      ...base,
      kind: "interaction_completed",
      commandId: "cmd:1",
      actorId: "robot:1",
      targetId: "objective:1",
    },
    { ...base, kind: "state_checkpoint", commandIndex: 0, stateHash: "0123456789abcdef" },
    {
      ...base,
      kind: "battle_phase_changed",
      commandId: "cmd:1",
      fromPhase: "player_planning",
      toPhase: "player_action",
    },
    {
      ...base,
      kind: "battle_effect_applied",
      commandId: "cmd:1",
      effectId: "effect:1",
      effectKind: "energy_changed",
      sourceId: "robot:1",
      targetId: "robot:2",
      targetX: 1,
      targetY: 2,
      magnitude: -2,
      duration: 0,
      detailHash: "0123456789abcdef",
    },
    {
      ...base,
      kind: "battle_effect_applied",
      commandId: "cmd:fall",
      effectId: "effect:fall",
      effectKind: "actor_moved",
      sourceId: "environment",
      targetId: "robot:1",
      targetX: 1,
      targetY: 2,
      magnitude: 3,
      duration: 0,
      detailHash: "0123456789abcdef",
    },
  ])("parses $kind events", (event) => {
    expect(parseBattleEvent(event)).toEqual(event);
  });

  it("rejects unknown fields and invalid hashes", () => {
    expect(
      battleEventSchema.safeParse({
        ...base,
        kind: "state_checkpoint",
        commandIndex: 0,
        stateHash: "bad",
        internalState: {},
      }).success,
    ).toBe(false);
  });

  it("rejects incomplete effect coordinates", () => {
    expect(
      battleEventSchema.safeParse({
        ...base,
        kind: "battle_effect_applied",
        commandId: "cmd:1",
        effectId: "effect:1",
        effectKind: "energy_changed",
        sourceId: "robot:1",
        targetX: 1,
        magnitude: 1,
        duration: 0,
        detailHash: "0123456789abcdef",
      }).success,
    ).toBe(false);
  });
});
