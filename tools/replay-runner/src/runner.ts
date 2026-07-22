import { readFileSync } from "node:fs";

import { verifyReplay } from "@skymenders/deterministic-runtime";

import { runtimeLedgerReducer } from "./runtime-ledger.js";

export function verifyRuntimeLedgerFile(path: string): {
  readonly finalHash: string;
  readonly events: number;
} {
  const input = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const execution = verifyReplay(input, runtimeLedgerReducer);
  return { finalHash: execution.finalHash, events: execution.events.length };
}
