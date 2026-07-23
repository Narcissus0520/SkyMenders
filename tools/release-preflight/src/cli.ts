import { resolve } from "node:path";

import { runPreflight } from "./preflight.js";

const root = resolve(import.meta.dirname, "../../..");
const strict = process.argv.includes("--strict");
const workflowVersion = normalizeVersion(process.env.RELEASE_CANDIDATE_VERSION);
const workflowCommit = process.env.RELEASE_CANDIDATE_COMMIT;
const result = runPreflight(
  root,
  resolve(root, "config/release/release-evidence.json"),
  resolve(root, "docs/status/KNOWN_ISSUES.md"),
  resolve(root, "docs/status/EXTERNAL_BLOCKERS.md"),
  strict,
  workflowVersion !== undefined && workflowCommit !== undefined
    ? { version: workflowVersion, commit: workflowCommit }
    : undefined,
);

process.stdout.write(
  `release preflight: ${result.passed.length} passed, ${result.blocked.length} blocked\n`,
);
if (result.blocked.length > 0)
  process.stdout.write(`blocked gates: ${result.blocked.join(", ")}\n`);
if (result.errors.length > 0) {
  result.errors.forEach((error) => process.stderr.write(`${error}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write(`${strict ? "strict release gate" : "release readiness check"}: passed\n`);
}

function normalizeVersion(value: string | undefined): string | undefined {
  return value?.startsWith("v") ? value.slice(1) : value;
}
