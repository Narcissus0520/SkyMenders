import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const generativeAiSchema = z.discriminatedUnion("used", [
  z.object({ used: z.literal(false) }).strict(),
  z
    .object({
      used: z.literal(true),
      tool: z.string().min(1),
      process: z.string().min(1),
      approved: z.boolean(),
    })
    .strict(),
]);
const entrySchema = z
  .object({
    assetId: z.string().regex(/^[a-z][a-z0-9_]*$/),
    path: z.string().min(1),
    category: z.enum(["art", "font", "music", "sfx", "ui", "other"]),
    author: z.string().min(1),
    createdAt: z.iso.date(),
    sourceFile: z.string().min(1),
    sourceLocation: z.string().min(1),
    license: z.string().min(1),
    licenseEvidence: z.string().min(1),
    commercialUse: z.boolean(),
    modificationAllowed: z.boolean(),
    generativeAi: generativeAiSchema,
    referenceSources: z.array(z.string().min(1)),
    sha256: sha256Schema,
    reviewer: z.string().min(1),
    reviewedAt: z.iso.date(),
    status: z.enum(["development", "approved", "rejected"]),
    placeholder: z.boolean(),
  })
  .strict();

const registrySchema = z
  .object({
    schemaVersion: z.literal("2.0.0"),
    forbiddenFingerprints: z.array(sha256Schema),
    entries: z.array(entrySchema),
  })
  .strict();

const prohibitedLicensePattern =
  /(?:^|[-_\s])(agpl|gpl|noncommercial|non-commercial|evaluation|personal-use)(?:$|[-_\s])/i;
const prohibitedNamePattern = /(?:worms|百战天虫)/i;

export interface AuditResult {
  readonly errors: readonly string[];
  readonly auditedReleaseFiles: number;
}

export function auditAssets(
  registryPath: string,
  releaseRoot: string,
  releaseMode = false,
): AuditResult {
  let registry: z.infer<typeof registrySchema>;
  try {
    registry = registrySchema.parse(JSON.parse(readFileSync(registryPath, "utf8")) as unknown);
  } catch (error) {
    return { errors: [`Invalid asset registry: ${String(error)}`], auditedReleaseFiles: 0 };
  }

  const errors: string[] = [];
  const repositoryRoot = resolve(releaseRoot, "..", "..");
  const entriesByPath = new Map<string, z.infer<typeof entrySchema>>();
  const assetIds = new Set<string>();
  for (const entry of registry.entries) {
    const normalizedPath = normalize(entry.path);
    if (
      !normalizedPath.startsWith("assets/release/") ||
      safeRepositoryPath(repositoryRoot, entry.path) === undefined
    ) {
      errors.push(`Registry asset path is outside assets/release: ${entry.path}`);
    }
    if (entriesByPath.has(normalizedPath)) errors.push(`Duplicate asset path: ${normalizedPath}`);
    if (assetIds.has(entry.assetId)) errors.push(`Duplicate asset ID: ${entry.assetId}`);
    entriesByPath.set(normalizedPath, entry);
    assetIds.add(entry.assetId);
  }

  const releaseFiles = existsSync(releaseRoot)
    ? walkFiles(releaseRoot).filter((path) => !isMetadataFile(path))
    : [];
  if (releaseMode && releaseFiles.length === 0) {
    errors.push("Strict release audit requires approved release assets");
  }

  for (const absolutePath of releaseFiles) {
    const assetPath = normalize(relative(repositoryRoot, absolutePath));
    if (prohibitedNamePattern.test(assetPath)) {
      errors.push(`Release asset path contains a prohibited competitor term: ${assetPath}`);
    }
    const entry = entriesByPath.get(assetPath);
    if (entry === undefined) {
      errors.push(`Release asset is missing provenance: ${assetPath}`);
      continue;
    }
    auditReleaseEntry(entry, repositoryRoot, absolutePath, registry.forbiddenFingerprints, errors);
  }

  for (const entry of registry.entries) {
    if (entry.status !== "approved") continue;
    const assetPath = safeRepositoryPath(repositoryRoot, entry.path);
    if (assetPath === undefined) {
      errors.push(`Approved asset path escapes the repository: ${entry.path}`);
    } else if (!existsSync(assetPath)) {
      errors.push(`Approved registry entry points to a missing file: ${entry.path}`);
    }
  }

  if (releaseMode) {
    const approvedCategories = new Set(
      registry.entries
        .filter((entry) => entry.status === "approved" && !entry.placeholder)
        .map((entry) => entry.category),
    );
    for (const category of ["art", "font", "music", "sfx", "ui"] as const) {
      if (!approvedCategories.has(category)) {
        errors.push(`Strict release audit is missing approved ${category} assets`);
      }
    }
  }

  return { errors, auditedReleaseFiles: releaseFiles.length };
}

function auditReleaseEntry(
  entry: z.infer<typeof entrySchema>,
  repositoryRoot: string,
  absolutePath: string,
  forbiddenFingerprints: readonly string[],
  errors: string[],
): void {
  if (entry.status !== "approved" || !entry.commercialUse) {
    errors.push(`Release asset is not approved for commercial use: ${entry.path}`);
  }
  if (entry.placeholder) errors.push(`Release asset is marked as a placeholder: ${entry.path}`);
  if (prohibitedLicensePattern.test(entry.license)) {
    errors.push(`Release asset uses a prohibited license: ${entry.path}`);
  }
  if (entry.generativeAi.used && !entry.generativeAi.approved) {
    errors.push(`Release asset has unapproved generative-AI provenance: ${entry.path}`);
  }
  if (
    prohibitedNamePattern.test(
      `${entry.assetId} ${entry.author} ${entry.sourceFile} ${entry.sourceLocation} ${entry.licenseEvidence} ${entry.referenceSources.join(" ")}`,
    )
  ) {
    errors.push(`Release asset provenance contains a prohibited competitor term: ${entry.path}`);
  }

  auditEvidencePath(repositoryRoot, entry.sourceFile, entry.path, "source file", errors);
  auditEvidencePath(repositoryRoot, entry.licenseEvidence, entry.path, "license evidence", errors);

  const actualHash = createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
  if (actualHash !== entry.sha256)
    errors.push(`Release asset hash does not match registry: ${entry.path}`);
  if (forbiddenFingerprints.includes(actualHash)) {
    errors.push(`Release asset matches a prohibited fingerprint: ${entry.path}`);
  }
}

function auditEvidencePath(
  repositoryRoot: string,
  evidencePath: string,
  assetPath: string,
  label: string,
  errors: string[],
): void {
  const absoluteEvidencePath = safeRepositoryPath(repositoryRoot, evidencePath);
  if (
    absoluteEvidencePath === undefined ||
    !existsSync(absoluteEvidencePath) ||
    !statSync(absoluteEvidencePath).isFile()
  ) {
    errors.push(`Release asset ${label} is missing: ${assetPath}`);
  }
}

function safeRepositoryPath(repositoryRoot: string, path: string): string | undefined {
  if (isAbsolute(path)) return undefined;
  const absolutePath = resolve(repositoryRoot, path);
  const relativePath = relative(repositoryRoot, absolutePath);
  return relativePath.startsWith("..") || isAbsolute(relativePath) ? undefined : absolutePath;
}

function isMetadataFile(path: string): boolean {
  return ["README.md", ".gitkeep"].includes(basename(path));
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/");
}

function walkFiles(root: string): string[] {
  return readdirSync(root)
    .map((name) => join(root, name))
    .flatMap((path) => (statSync(path).isDirectory() ? walkFiles(path) : [path]));
}
