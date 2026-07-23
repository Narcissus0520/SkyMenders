import { resolve } from "node:path";

import { auditPackage } from "./auditor.js";

const root = resolve(import.meta.dirname, "../../..");
const releaseMode = process.argv.includes("--release");
const result = auditPackage(resolve(root, "config/release/package-budget.json"), root, releaseMode);

process.stdout.write(
  `package budget (${result.mode}): main=${result.mainPackageBytes} bytes, total=${result.totalPackageBytes} bytes\n`,
);
for (const subpackage of result.subpackages) {
  process.stdout.write(`subpackage ${subpackage.name}: ${subpackage.bytes} bytes\n`);
}
result.warnings.forEach((warning) => process.stdout.write(`warning: ${warning}\n`));
if (result.errors.length > 0) {
  result.errors.forEach((error) => process.stderr.write(`${error}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write("package budget audit: passed\n");
}
