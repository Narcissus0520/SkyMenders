import { join } from "node:path";

import { reportAndExit, repositoryRoot } from "./cli.js";
import { inspectCompose } from "./infra.js";

reportAndExit(
  "infrastructure policy",
  inspectCompose(join(repositoryRoot(), "docker-compose.yml")),
);
