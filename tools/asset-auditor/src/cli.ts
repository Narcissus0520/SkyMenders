import { resolve } from "node:path";

import { auditAssets } from "./auditor.js";

const root = resolve(import.meta.dirname, "../../..");
const releaseMode = process.argv.includes("--release");
const result = auditAssets(
  resolve(root, "assets/provenance/asset-registry.json"),
  resolve(root, "assets/release"),
  releaseMode,
);

if (result.errors.length > 0) {
  result.errors.forEach((error) => process.stderr.write(`${error}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write("asset provenance audit: passed\n");
}
