import { reportAndExit, repositoryRoot } from "./cli.js";
import { inspectAuthoritySources } from "./determinism-policy.js";

reportAndExit("determinism policy", inspectAuthoritySources(repositoryRoot()));
