import { resolve } from "node:path";

import { validateManifest } from "./validator.js";

const root = resolve(import.meta.dirname, "../../..");
const result = validateManifest(resolve(root, "content/manifests/content-manifest.json"));

if (result.errors.length > 0) {
  result.errors.forEach((error) => process.stderr.write(`${error}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write(
    `content manifest ${result.manifest?.contentVersion ?? "unknown"}: passed\n`,
  );
}
