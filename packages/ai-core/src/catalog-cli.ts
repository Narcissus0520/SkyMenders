import { validateAiCatalog } from "./validator.js";

const report = validateAiCatalog();
if (!report.valid) {
  for (const issue of report.issues) {
    process.stderr.write(`${issue.code} ${issue.path}: ${issue.message}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("AI catalog: 8 enemies, 8 elite templates, and 4 bosses passed\n");
}
