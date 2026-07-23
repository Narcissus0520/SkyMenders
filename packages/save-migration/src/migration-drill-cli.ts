import { resolve } from "node:path";

import { runSaveMigrationDrill } from "./migration-drill.js";

const fixture = resolve(import.meta.dirname, "../fixtures/legacy-expedition-0.0.1.json");

try {
  const results = await runSaveMigrationDrill([fixture]);
  console.log(
    `save migration drill: passed (${results.map((result) => `${result.sourceSchemaVersion}:${result.resultIntegrityHash.slice(0, 12)}`).join(", ")})`,
  );
} catch (error) {
  console.error(`save migration drill failed: ${String(error)}`);
  process.exitCode = 1;
}
