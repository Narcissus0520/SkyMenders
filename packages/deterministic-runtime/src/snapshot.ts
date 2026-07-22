import { canonicalClone } from "./canonical.js";
import type { CanonicalValue } from "./canonical.js";
import { hashCanonical } from "./hash.js";
import { validateRngState } from "./rng.js";
import type { RngState, RngStreamName } from "./rng.js";

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export interface RuntimeSnapshot<TState extends CanonicalValue> {
  readonly snapshotSchemaVersion: string;
  readonly rulesVersion: string;
  readonly contentVersion: string;
  readonly replaySchemaVersion: string;
  readonly turnIndex: number;
  readonly commandIndex: number;
  readonly rngStates: Readonly<Partial<Record<RngStreamName, RngState>>>;
  readonly state: TState;
  readonly stateHash: string;
}

export interface SnapshotInput<TState extends CanonicalValue> {
  readonly rulesVersion: string;
  readonly contentVersion: string;
  readonly replaySchemaVersion: string;
  readonly turnIndex: number;
  readonly commandIndex: number;
  readonly rngStates: Readonly<Partial<Record<RngStreamName, RngState>>>;
  readonly state: TState;
}

export function createSnapshot<TState extends CanonicalValue>(
  input: SnapshotInput<TState>,
): RuntimeSnapshot<TState> {
  assertNonNegativeInteger(input.turnIndex, "turn index");
  assertNonNegativeInteger(input.commandIndex, "command index");
  assertVersion(input.rulesVersion, "rules version");
  assertVersion(input.contentVersion, "content version");
  assertVersion(input.replaySchemaVersion, "replay schema version");
  Object.values(input.rngStates).forEach((state) => {
    validateRngState(state);
  });

  const detached = canonicalClone({
    turnIndex: input.turnIndex,
    commandIndex: input.commandIndex,
    rngStates: input.rngStates,
    state: input.state,
  });
  const stateHash = hashCanonical(detached);
  return {
    snapshotSchemaVersion: "0.1.0",
    rulesVersion: input.rulesVersion,
    contentVersion: input.contentVersion,
    replaySchemaVersion: input.replaySchemaVersion,
    turnIndex: detached.turnIndex,
    commandIndex: detached.commandIndex,
    rngStates: detached.rngStates,
    state: detached.state,
    stateHash,
  };
}

export function verifySnapshot<TState extends CanonicalValue>(
  snapshot: RuntimeSnapshot<TState>,
  expected: Pick<
    RuntimeSnapshot<TState>,
    "rulesVersion" | "contentVersion" | "replaySchemaVersion"
  >,
): TState {
  if (snapshot.snapshotSchemaVersion !== "0.1.0") {
    throw new Error(`unsupported snapshot schema: ${snapshot.snapshotSchemaVersion}`);
  }
  assertNonNegativeInteger(snapshot.turnIndex, "turn index");
  assertNonNegativeInteger(snapshot.commandIndex, "command index");
  Object.values(snapshot.rngStates).forEach((state) => {
    validateRngState(state);
  });
  for (const key of ["rulesVersion", "contentVersion", "replaySchemaVersion"] as const) {
    if (snapshot[key] !== expected[key]) {
      throw new Error(`${key} mismatch: expected ${expected[key]}, received ${snapshot[key]}`);
    }
  }
  const actualHash = hashCanonical({
    turnIndex: snapshot.turnIndex,
    commandIndex: snapshot.commandIndex,
    rngStates: snapshot.rngStates,
    state: snapshot.state,
  });
  if (actualHash !== snapshot.stateHash) {
    throw new Error(
      `snapshot hash mismatch: expected ${snapshot.stateHash}, received ${actualHash}`,
    );
  }
  return canonicalClone(snapshot.state);
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function assertVersion(value: string, label: string): void {
  if (!VERSION_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a semantic version`);
  }
}
