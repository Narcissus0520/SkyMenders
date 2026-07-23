import { resolve } from "node:path";

import { runContentRollbackDrill } from "./rollback-drill.js";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

try {
  const result = await runContentRollbackDrill(repositoryRoot);
  console.log(
    `content rollback drill: passed (${result.replacementPublicationId.slice(0, 12)} -> ${result.restoredPublicationId.slice(0, 12)}, freeze enforced)`,
  );
} catch (error) {
  console.error(`content rollback drill failed: ${String(error)}`);
  process.exitCode = 1;
}
