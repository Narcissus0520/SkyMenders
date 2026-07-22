import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { repositoryRoot } from "./cli.js";
import { createSbom } from "./sbom.js";

const root = repositoryRoot();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  readonly version: string;
};
const outputPath = join(root, "artifacts", "sbom.cdx.json");
const bom = createSbom(join(root, "pnpm-lock.yaml"), packageJson.version);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(bom, null, 2)}\n`, "utf8");
process.stdout.write(`SBOM: ${bom.components.length} components -> ${outputPath}\n`);
