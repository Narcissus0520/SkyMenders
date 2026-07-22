import { describe, expect, it } from "vitest";

import { createRngState, createSnapshot, verifySnapshot } from "../src/index.js";

const versions = {
  rulesVersion: "0.1.0",
  contentVersion: "0.0.0",
  replaySchemaVersion: "0.1.0",
};

describe("runtime snapshot", () => {
  it("detaches state and verifies versions and hash", () => {
    const state = { energy: 6, actors: [{ id: "robot:1", x: 1_000 }] };
    const snapshot = createSnapshot({
      ...versions,
      turnIndex: 2,
      commandIndex: 5,
      rngStates: { map: createRngState(1), reward: createRngState(2) },
      state,
    });
    state.energy = 0;
    expect(snapshot.state.energy).toBe(6);
    const restored = verifySnapshot(snapshot, versions);
    expect(restored).toEqual(snapshot.state);
    expect(restored).not.toBe(snapshot.state);
  });

  it("rejects invalid indices, RNG, schema, versions, and tampering", () => {
    expect(() =>
      createSnapshot({
        ...versions,
        turnIndex: -1,
        commandIndex: 0,
        rngStates: {},
        state: { value: 1 },
      }),
    ).toThrow("turn index");
    expect(() =>
      createSnapshot({
        ...versions,
        turnIndex: 0,
        commandIndex: -1,
        rngStates: {},
        state: { value: 1 },
      }),
    ).toThrow("command index");
    expect(() =>
      createSnapshot({
        ...versions,
        turnIndex: 0,
        commandIndex: 0,
        rngStates: { map: [0, 0, 0, 0] },
        state: { value: 1 },
      }),
    ).toThrow("all zero");
    expect(() =>
      createSnapshot({
        ...versions,
        rulesVersion: "latest",
        turnIndex: 0,
        commandIndex: 0,
        rngStates: {},
        state: { value: 1 },
      }),
    ).toThrow("semantic version");

    const snapshot = createSnapshot({
      ...versions,
      turnIndex: 0,
      commandIndex: 0,
      rngStates: {},
      state: { value: 1 },
    });
    expect(() => verifySnapshot({ ...snapshot, snapshotSchemaVersion: "bad" }, versions)).toThrow(
      "unsupported snapshot schema",
    );
    expect(() => verifySnapshot(snapshot, { ...versions, rulesVersion: "0.2.0" })).toThrow(
      "rulesVersion mismatch",
    );
    expect(() => verifySnapshot({ ...snapshot, turnIndex: -1 }, versions)).toThrow("turn index");
    expect(() =>
      verifySnapshot({ ...snapshot, rngStates: { map: [0, 0, 0, 0] } }, versions),
    ).toThrow("all zero");
    expect(() => verifySnapshot({ ...snapshot, state: { value: 2 } }, versions)).toThrow(
      "snapshot hash mismatch",
    );
  });
});
