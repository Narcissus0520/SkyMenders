import { resolve } from "node:path";

import { validateContentDirectory, validateManifest } from "./validator.js";

const root = resolve(import.meta.dirname, "../../..");
const result = validateManifest(resolve(root, "content/manifests/content-manifest.json"));
const content = validateContentDirectory(resolve(root, "content"));

if (result.errors.length > 0 || !content.report.valid) {
  result.errors.forEach((error) => process.stderr.write(`${error}\n`));
  content.report.issues.forEach((issue) =>
    process.stderr.write(`${issue.code} ${issue.path}: ${issue.message}\n`),
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `content manifest ${result.manifest?.contentVersion ?? "unknown"}: passed (${JSON.stringify(content.report.counts)})\n`,
  );
}
