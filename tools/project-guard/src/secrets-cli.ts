import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { reportAndExit, repositoryRoot } from "./cli.js";
import { inspectSecrets } from "./secret-policy.js";

const root = repositoryRoot();
const relativePaths = execFileSync("git", ["ls-files", "-c", "-o", "--exclude-standard", "-z"], {
  cwd: root,
})
  .toString("utf8")
  .split("\0")
  .filter((path) => path.length > 0 && !path.endsWith("pnpm-lock.yaml"));

reportAndExit(
  "secret policy",
  inspectSecrets(relativePaths.map((relativePath) => join(root, relativePath))),
);
