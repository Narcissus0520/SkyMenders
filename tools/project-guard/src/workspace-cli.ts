import { reportAndExit, repositoryRoot } from "./cli.js";
import { inspectWorkspace } from "./policy.js";

const root = repositoryRoot();
reportAndExit("workspace policy", inspectWorkspace(root));
