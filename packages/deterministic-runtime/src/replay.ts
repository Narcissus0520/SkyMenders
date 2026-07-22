import { parseBattleCommand, parseBattleEvent, parseReplayFile } from "@skymenders/protocol";
import type {
  BattleCommand,
  BattleEvent,
  ReplayCheckpoint,
  ReplayFile,
} from "@skymenders/protocol";

import { canonicalClone } from "./canonical.js";
import type { CanonicalValue } from "./canonical.js";
import { hashCanonical } from "./hash.js";

export interface ReducerResult<TState extends CanonicalValue> {
  readonly state: TState;
  readonly events: readonly BattleEvent[];
}

export interface ReplayContext {
  readonly commandIndex: number;
  readonly rootSeed: number;
  readonly replaySchemaVersion: string;
  readonly rulesVersion: string;
  readonly contentVersion: string;
}

export type DeterministicReducer<TState extends CanonicalValue> = (
  state: Readonly<TState>,
  command: BattleCommand,
  commandIndex: number,
  context: Readonly<ReplayContext>,
) => ReducerResult<TState>;

export interface ReplayExecution<TState extends CanonicalValue> {
  readonly finalState: TState;
  readonly finalHash: string;
  readonly checkpoints: readonly ReplayCheckpoint[];
  readonly events: readonly BattleEvent[];
}

export function executeReplay<TState extends CanonicalValue>(
  input: unknown,
  reducer: DeterministicReducer<TState>,
): ReplayExecution<TState> {
  const replay = parseReplayFile(input);
  let state = canonicalClone(replay.initialState as TState);
  const events: BattleEvent[] = [];
  const checkpoints: ReplayCheckpoint[] = [];

  replay.commands.forEach((inputCommand, commandIndex) => {
    const command = parseBattleCommand(inputCommand);
    const result = reducer(canonicalClone(state), command, commandIndex, {
      commandIndex,
      rootSeed: replay.rootSeed,
      replaySchemaVersion: replay.replaySchemaVersion,
      rulesVersion: replay.rulesVersion,
      contentVersion: replay.contentVersion,
    });
    state = canonicalClone(result.state);
    for (const inputEvent of result.events) {
      const event = parseBattleEvent(inputEvent);
      if (event.sequence !== events.length) {
        throw new Error(
          `event sequence mismatch: expected ${events.length}, received ${event.sequence}`,
        );
      }
      events.push(event);
    }
    checkpoints.push({ commandIndex, stateHash: hashCanonical(state) });
  });

  return {
    finalState: state,
    finalHash: hashCanonical(state),
    checkpoints,
    events,
  };
}

export function verifyReplay<TState extends CanonicalValue>(
  input: unknown,
  reducer: DeterministicReducer<TState>,
): ReplayExecution<TState> {
  const replay: ReplayFile = parseReplayFile(input);
  const execution = executeReplay<TState>(replay, reducer);
  if (execution.finalHash !== replay.expectedFinalHash) {
    throw new Error(
      `replay final hash mismatch: expected ${replay.expectedFinalHash}, received ${execution.finalHash}`,
    );
  }
  if (execution.checkpoints.length !== replay.expectedCheckpoints.length) {
    throw new Error("replay checkpoint count mismatch");
  }
  execution.checkpoints.forEach((checkpoint, index) => {
    const expected = replay.expectedCheckpoints[index];
    if (
      checkpoint.commandIndex !== expected?.commandIndex ||
      checkpoint.stateHash !== expected.stateHash
    ) {
      throw new Error(`replay checkpoint mismatch at index ${index}`);
    }
  });
  return execution;
}
