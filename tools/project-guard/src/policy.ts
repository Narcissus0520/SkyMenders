import { existsSync } from "node:fs";
import { join } from "node:path";

export interface PolicyIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export const REQUIRED_ROOT_FILES = [
  "AGENTS.md",
  "README.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "docker-compose.yml",
  ".env.example",
] as const;

export const REQUIRED_STATUS_FILES = [
  "docs/status/PROJECT_STATUS.md",
  "docs/status/IMPLEMENTATION_PLAN.md",
  "docs/status/KNOWN_ISSUES.md",
  "docs/status/EXTERNAL_BLOCKERS.md",
  "docs/status/RELEASE_READINESS.md",
] as const;

const FORBIDDEN_LOCKFILES = ["package-lock.json", "yarn.lock"] as const;

export function inspectWorkspace(root: string, nodeVersion = process.versions.node): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  const major = Number.parseInt(nodeVersion.split(".")[0] ?? "", 10);

  if (major !== 24) {
    issues.push({
      code: "NODE_VERSION",
      message: `Node.js 24 LTS is required; received ${nodeVersion}`,
    });
  }

  for (const relativePath of [...REQUIRED_ROOT_FILES, ...REQUIRED_STATUS_FILES]) {
    if (!existsSync(join(root, relativePath))) {
      issues.push({
        code: "REQUIRED_FILE",
        message: `Required repository file is missing: ${relativePath}`,
        path: relativePath,
      });
    }
  }

  for (const relativePath of FORBIDDEN_LOCKFILES) {
    if (existsSync(join(root, relativePath))) {
      issues.push({
        code: "LOCKFILE_POLICY",
        message: `Mixed package-manager lockfile is forbidden: ${relativePath}`,
        path: relativePath,
      });
    }
  }

  return issues;
}
