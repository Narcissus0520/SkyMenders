import { spawnSync } from "node:child_process";

import type { CommandResult } from "./restore-drill.js";

export function runProcessCommand(
  command: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>>,
): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, ...environment },
    shell: false,
  });
  if (result.error !== undefined) return { status: 1, stdout: "", stderr: result.error.message };
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}
