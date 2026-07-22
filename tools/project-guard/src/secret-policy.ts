import { readFileSync } from "node:fs";

import type { PolicyIssue } from "./policy.js";

const SECRET_PATTERNS = [
  { code: "GITHUB_TOKEN", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/u },
  { code: "PRIVATE_KEY", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  {
    code: "WECHAT_SECRET",
    pattern: /\bWECHAT_APP_SECRET[ \t]*=[ \t]*[^\s#][^\r\n]*/u,
  },
] as const;

export function inspectSecrets(paths: readonly string[]): PolicyIssue[] {
  const issues: PolicyIssue[] = [];

  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    for (const secret of SECRET_PATTERNS) {
      if (secret.pattern.test(source)) {
        issues.push({
          code: secret.code,
          message: `Potential secret detected in ${path}`,
          path,
        });
      }
    }
  }

  return issues;
}
