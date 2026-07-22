import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { z } from "zod";

const entrySchema = z
  .object({
    assetId: z.string().regex(/^[a-z][a-z0-9_]*$/),
    path: z.string().min(1),
    author: z.string().min(1),
    createdAt: z.iso.date(),
    license: z.string().min(1),
    commercialUse: z.boolean(),
    modificationAllowed: z.boolean(),
    generativeAi: z.boolean(),
    source: z.string().min(1),
    reviewer: z.string().min(1),
    status: z.enum(["development", "approved", "rejected"]),
  })
  .strict();

const registrySchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  entries: z.array(entrySchema),
});

export interface AuditResult {
  readonly errors: readonly string[];
}

export function auditAssets(registryPath: string, releaseRoot: string): AuditResult {
  let registry: z.infer<typeof registrySchema>;
  try {
    registry = registrySchema.parse(JSON.parse(readFileSync(registryPath, "utf8")) as unknown);
  } catch (error) {
    return { errors: [`Invalid asset registry: ${String(error)}`] };
  }

  const errors: string[] = [];
  const entriesByPath = new Map(registry.entries.map((entry) => [normalize(entry.path), entry]));
  const releaseFiles = existsSync(releaseRoot)
    ? walkFiles(releaseRoot).filter((path) => !isMetadataFile(path))
    : [];

  for (const absolutePath of releaseFiles) {
    const repositoryRoot = join(releaseRoot, "..", "..");
    const assetPath = normalize(relative(repositoryRoot, absolutePath));
    const entry = entriesByPath.get(assetPath);
    if (entry === undefined) {
      errors.push(`Release asset is missing provenance: ${assetPath}`);
      continue;
    }
    if (entry.status !== "approved" || !entry.commercialUse) {
      errors.push(`Release asset is not approved for commercial use: ${assetPath}`);
    }
  }

  for (const entry of registry.entries) {
    if (entry.status === "approved" && !existsSync(join(releaseRoot, "..", "..", entry.path))) {
      errors.push(`Approved registry entry points to a missing file: ${entry.path}`);
    }
  }

  return { errors };
}

function isMetadataFile(path: string): boolean {
  return [".md", ".json"].includes(extname(path).toLowerCase());
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/");
}

function walkFiles(root: string): string[] {
  return readdirSync(root)
    .map((name) => join(root, name))
    .flatMap((path) => (statSync(path).isDirectory() ? walkFiles(path) : [path]));
}
