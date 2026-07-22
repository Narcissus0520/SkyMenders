import { resolve } from "node:path";

import { verifyRuntimeLedgerFile } from "./runner.js";

export type ReplayCliWriter = (message: string) => unknown;

export function runReplayCli(
  inputPath?: string,
  write: ReplayCliWriter = (message) => process.stdout.write(message),
): void {
  const repositoryRoot = resolve(import.meta.dirname, "../../..");
  const path =
    inputPath ?? resolve(repositoryRoot, "packages/test-fixtures/replays/runtime-ledger-v1.json");
  const result = verifyRuntimeLedgerFile(path);

  write(`golden replay: passed (${result.events} events, ${result.finalHash})\n`);
}
