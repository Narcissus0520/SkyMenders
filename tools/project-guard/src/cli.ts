import { resolve } from "node:path";

import type { PolicyIssue } from "./policy.js";

export function repositoryRoot(): string {
  return resolve(import.meta.dirname, "../../..");
}

export function reportAndExit(scope: string, issues: readonly PolicyIssue[]): void {
  if (issues.length === 0) {
    process.stdout.write(`${scope}: passed\n`);
    return;
  }

  for (const issue of issues) {
    process.stderr.write(`[${issue.code}] ${issue.message}\n`);
  }
  process.exitCode = 1;
}
