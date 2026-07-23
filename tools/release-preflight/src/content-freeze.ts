import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { z } from "zod";

const entrySchema = z
  .object({
    path: z.string().regex(/^content\/[A-Za-z0-9_./-]+\.json$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const contentFreezeSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    rulesVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    catalogs: z.array(entrySchema).min(1),
  })
  .strict();

export type ContentFreezeLock = z.infer<typeof contentFreezeSchema>;

export function createContentFreezeLock(
  repositoryRoot: string,
  rulesVersion: string,
): ContentFreezeLock {
  if (!/^\d+\.\d+\.\d+$/.test(rulesVersion)) throw new Error("invalid freeze rules version");
  const manifestPath = resolve(repositoryRoot, "content/manifests/content-manifest.json");
  const manifest = z
    .object({ contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/) })
    .loose()
    .parse(JSON.parse(readFileSync(manifestPath, "utf8")) as unknown);
  return {
    schemaVersion: "1.0.0",
    contentVersion: manifest.contentVersion,
    rulesVersion,
    catalogs: contentJsonPaths(repositoryRoot).map((path) => ({
      path,
      sha256: digest(readFileSync(resolve(repositoryRoot, path))),
    })),
  };
}

export function writeContentFreezeLock(path: string, lock: ContentFreezeLock): void {
  writeFileSync(path, `${JSON.stringify(contentFreezeSchema.parse(lock), null, 2)}\n`, "utf8");
}

export function verifyContentFreezeLock(
  repositoryRoot: string,
  lockPath: string,
  expectedRulesVersion?: string,
): readonly string[] {
  let lock: ContentFreezeLock;
  try {
    lock = contentFreezeSchema.parse(JSON.parse(readFileSync(lockPath, "utf8")) as unknown);
  } catch (error) {
    return [`Invalid content freeze lock: ${String(error)}`];
  }
  const errors: string[] = [];
  if (expectedRulesVersion !== undefined && lock.rulesVersion !== expectedRulesVersion)
    errors.push(
      `Content freeze rules version ${lock.rulesVersion} does not match ${expectedRulesVersion}`,
    );
  const actualPaths = contentJsonPaths(repositoryRoot);
  const lockedPaths = lock.catalogs.map((entry) => entry.path);
  if (new Set(lockedPaths).size !== lockedPaths.length)
    errors.push("Content freeze lock contains duplicate catalog paths");
  for (const path of actualPaths) {
    if (!lockedPaths.includes(path)) errors.push(`Content freeze is missing catalog: ${path}`);
  }
  for (const entry of lock.catalogs) {
    const absolute = safeRepositoryPath(repositoryRoot, entry.path);
    if (absolute === undefined || !actualPaths.includes(entry.path)) {
      errors.push(`Content freeze contains an unsafe or unexpected catalog: ${entry.path}`);
      continue;
    }
    const raw = readFileSync(absolute);
    if (digest(raw) !== entry.sha256) errors.push(`Frozen catalog hash changed: ${entry.path}`);
    if (!entry.path.endsWith("localization/zh-CN.json")) {
      const value = z
        .object({ contentVersion: z.string() })
        .loose()
        .safeParse(JSON.parse(raw.toString("utf8")) as unknown);
      if (!value.success || value.data.contentVersion !== lock.contentVersion)
        errors.push(`Frozen catalog content version mismatch: ${entry.path}`);
    }
  }
  return errors.sort();
}

function contentJsonPaths(repositoryRoot: string): string[] {
  const root = resolve(repositoryRoot, "content");
  const paths: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json"))
        paths.push(relative(repositoryRoot, path).replaceAll("\\", "/"));
    }
  };
  visit(root);
  return paths.sort();
}

function safeRepositoryPath(repositoryRoot: string, path: string): string | undefined {
  if (isAbsolute(path)) return undefined;
  const absolute = resolve(repositoryRoot, path);
  const child = relative(repositoryRoot, absolute);
  return child.startsWith("..") || isAbsolute(child) ? undefined : absolute;
}

function digest(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
