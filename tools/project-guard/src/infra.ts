import { readFileSync } from "node:fs";

import { parse } from "yaml";

import type { PolicyIssue } from "./policy.js";

interface ComposeDocument {
  readonly services?: Record<string, { readonly healthcheck?: unknown; readonly image?: unknown }>;
}

const REQUIRED_SERVICES = ["postgres", "redis", "minio"] as const;

export function inspectCompose(path: string): PolicyIssue[] {
  const document = parse(readFileSync(path, "utf8")) as ComposeDocument;
  const issues: PolicyIssue[] = [];

  for (const serviceName of REQUIRED_SERVICES) {
    const service = document.services?.[serviceName];
    if (service === undefined) {
      issues.push({ code: "COMPOSE_SERVICE", message: `Missing Compose service: ${serviceName}` });
      continue;
    }
    if (typeof service.image !== "string" || service.image.length === 0) {
      issues.push({ code: "COMPOSE_IMAGE", message: `Service ${serviceName} must pin an image` });
    }
    if (service.healthcheck === undefined) {
      issues.push({
        code: "COMPOSE_HEALTHCHECK",
        message: `Service ${serviceName} must define a healthcheck`,
      });
    }
  }

  return issues;
}
