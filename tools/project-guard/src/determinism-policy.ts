import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import type { PolicyIssue } from "./policy.js";

const AUTHORITY_ROOTS = [
  "packages/deterministic-runtime",
  "packages/battle-core",
  "packages/terrain-core",
  "packages/ai-core",
] as const;

const FORBIDDEN_PATTERNS = [
  { code: "MATH_RANDOM", pattern: /\bMath\.random\s*\(/u },
  { code: "WALL_CLOCK", pattern: /\bDate\.now\s*\(/u },
  { code: "COCOS_AUTHORITY", pattern: /from\s+["']cc["']/u },
] as const;

export function inspectAuthoritySources(root: string): PolicyIssue[] {
  const issues: PolicyIssue[] = [];

  for (const authorityRoot of AUTHORITY_ROOTS) {
    const absoluteRoot = join(root, authorityRoot);
    if (!existsSync(absoluteRoot)) {
      continue;
    }

    for (const absolutePath of walkFiles(absoluteRoot)) {
      if (extname(absolutePath) !== ".ts" || absolutePath.endsWith(".test.ts")) {
        continue;
      }

      const source = readFileSync(absolutePath, "utf8");
      for (const forbidden of FORBIDDEN_PATTERNS) {
        if (forbidden.pattern.test(source)) {
          const sourcePath = relative(root, absolutePath).replaceAll("\\", "/");
          issues.push({
            code: forbidden.code,
            message: `Forbidden authority dependency in ${sourcePath}`,
            path: sourcePath,
          });
        }
      }
    }
  }

  return issues;
}

function walkFiles(root: string): string[] {
  return readdirSync(root)
    .map((name) => join(root, name))
    .flatMap((path) => (statSync(path).isDirectory() ? walkFiles(path) : [path]));
}
