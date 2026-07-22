import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { executeReplay } from "@skymenders/deterministic-runtime";

import { runReplayCli } from "../src/cli-runner.js";
import { runtimeLedgerReducer } from "../src/runtime-ledger.js";
import { verifyRuntimeLedgerFile } from "../src/runner.js";

const fixturePath = resolve(
  import.meta.dirname,
  "../../../packages/test-fixtures/replays/runtime-ledger-v1.json",
);

describe("runtime ledger golden replay", () => {
  it("matches every checkpoint and final hash", () => {
    expect(verifyRuntimeLedgerFile(fixturePath)).toEqual({
      finalHash: "73b0d3c57d06fa99",
      events: 12,
    });
  });

  it("executes identically across repeated runs", () => {
    const replay = JSON.parse(readFileSync(fixturePath, "utf8")) as unknown;
    const execution = executeReplay(replay, runtimeLedgerReducer);
    expect(execution).toEqual(executeReplay(replay, runtimeLedgerReducer));
    expect(
      execution.events
        .filter((event) => event.kind === "state_checkpoint")
        .map((event) => ({ commandIndex: event.commandIndex, stateHash: event.stateHash })),
    ).toEqual(execution.checkpoints);
  });

  it("binds the replay result to its root seed", () => {
    const replay = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
    const original = executeReplay(replay, runtimeLedgerReducer);
    const changed = executeReplay({ ...replay, rootSeed: 305_419_897 }, runtimeLedgerReducer);
    expect(changed.finalHash).not.toBe(original.finalHash);
  });

  it.each([undefined, fixturePath])("reports verification through the CLI runner", (path) => {
    const output: string[] = [];

    runReplayCli(path, (message) => output.push(message));

    expect(output).toEqual(["golden replay: passed (12 events, 73b0d3c57d06fa99)\n"]);
  });

  it("writes to stdout when no writer is supplied", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      runReplayCli(fixturePath);
      expect(write).toHaveBeenCalledWith("golden replay: passed (12 events, 73b0d3c57d06fa99)\n");
    } finally {
      write.mockRestore();
    }
  });
});
