import type { BattleEvent } from "@skymenders/protocol";
import { describe, expect, it } from "vitest";

import { executeReplay, hashCanonical, verifyReplay } from "../src/index.js";
import type { CanonicalValue, DeterministicReducer } from "../src/index.js";

interface CounterState extends Record<string, CanonicalValue> {
  readonly value: number;
}

const reducer: DeterministicReducer<CounterState> = (state, command, commandIndex) => {
  const event: BattleEvent = {
    kind: "turn_waited",
    battleId: command.battleId,
    commandId: command.commandId,
    actorId: command.actorId,
    turnIndex: command.turnIndex,
    sequence: commandIndex,
  };
  return { state: { value: state.value + 1 }, events: [event] };
};

function replay(
  expectedCheckpoints: readonly { commandIndex: number; stateHash: string }[],
  final: string,
) {
  return {
    replaySchemaVersion: "0.1.0",
    rulesVersion: "0.1.0",
    contentVersion: "0.0.0",
    fixtureId: "counter:1",
    rootSeed: 7,
    initialState: { value: 0 },
    commands: [
      { kind: "wait", commandId: "cmd:1", battleId: "battle:1", turnIndex: 0, actorId: "r:1" },
      { kind: "wait", commandId: "cmd:2", battleId: "battle:1", turnIndex: 0, actorId: "r:1" },
    ],
    expectedCheckpoints,
    expectedFinalHash: final,
  };
}

describe("generic deterministic replay", () => {
  it("executes, checkpoints, and verifies a replay", () => {
    const first = hashCanonical({ value: 1 });
    const second = hashCanonical({ value: 2 });
    const input = replay(
      [
        { commandIndex: 0, stateHash: first },
        { commandIndex: 1, stateHash: second },
      ],
      second,
    );
    const execution = verifyReplay<CounterState>(input, reducer);
    expect(execution.finalState).toEqual({ value: 2 });
    expect(execution.events).toHaveLength(2);
    expect(executeReplay<CounterState>(input, reducer)).toEqual(execution);
  });

  it("passes seed and compatibility versions to every reducer call", () => {
    const contexts: unknown[] = [];
    const capturingReducer: DeterministicReducer<CounterState> = (
      state,
      command,
      commandIndex,
      context,
    ) => {
      contexts.push(context);
      return reducer(state, command, commandIndex, context);
    };

    executeReplay<CounterState>(replay([], "0000000000000000"), capturingReducer);

    expect(contexts).toEqual([
      {
        commandIndex: 0,
        rootSeed: 7,
        replaySchemaVersion: "0.1.0",
        rulesVersion: "0.1.0",
        contentVersion: "0.0.0",
      },
      {
        commandIndex: 1,
        rootSeed: 7,
        replaySchemaVersion: "0.1.0",
        rulesVersion: "0.1.0",
        contentVersion: "0.0.0",
      },
    ]);
  });

  it("rejects bad event sequences, final hashes, checkpoint counts, and checkpoint values", () => {
    const badSequence: DeterministicReducer<CounterState> = (state, command) => ({
      state: { value: state.value },
      events: [
        {
          kind: "turn_waited",
          battleId: command.battleId,
          commandId: command.commandId,
          actorId: command.actorId,
          turnIndex: command.turnIndex,
          sequence: 99,
        },
      ],
    });
    const first = hashCanonical({ value: 1 });
    const second = hashCanonical({ value: 2 });
    expect(() => executeReplay<CounterState>(replay([], second), badSequence)).toThrow(
      "event sequence mismatch",
    );
    expect(() => verifyReplay<CounterState>(replay([], "0000000000000000"), reducer)).toThrow(
      "final hash mismatch",
    );
    expect(() => verifyReplay<CounterState>(replay([], second), reducer)).toThrow(
      "checkpoint count mismatch",
    );
    expect(() =>
      verifyReplay<CounterState>(
        replay(
          [
            { commandIndex: 0, stateHash: first },
            { commandIndex: 1, stateHash: "0000000000000000" },
          ],
          second,
        ),
        reducer,
      ),
    ).toThrow("checkpoint mismatch at index 1");
  });
});
