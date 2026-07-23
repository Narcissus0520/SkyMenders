import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";

export const requiredGateIds = [
  "automated-regression",
  "severity-zero",
  "content-freeze",
  "save-migration",
  "content-rollback",
  "submission-materials",
  "approved-assets",
  "complete-audio",
  "wechat-package",
  "device-matrix",
  "privacy-and-legal",
  "backup-and-restore",
  "production-operations",
  "public-name",
  "wechat-identity",
] as const;

const gateSchema = z.discriminatedUnion("status", [
  z
    .object({
      id: z.enum(requiredGateIds),
      status: z.literal("passed"),
      owner: z.string().min(1),
      evidence: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      id: z.enum(requiredGateIds),
      status: z.literal("blocked"),
      owner: z.string().min(1),
      blockerIds: z.array(z.string().regex(/^EXT-[0-9]{3}$/)).min(1),
      evidence: z.array(z.string().min(1)),
    })
    .strict(),
]);

const evidenceSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    candidateVersion: z
      .string()
      .regex(/^\d+\.\d+\.\d+-rc\.\d+$/)
      .nullable(),
    candidateCommit: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .nullable(),
    gates: z.array(gateSchema),
  })
  .strict();

const audioCueSchema = z
  .object({
    cueId: z.string().min(1),
    bus: z.enum(["music", "ambient", "battle", "ui"]),
    assetId: z.string().min(1).nullable(),
  })
  .loose();
const audioCatalogSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    releaseStatus: z.enum(["blocked", "ready"]),
    blockerId: z.string().optional(),
    music: z.array(audioCueSchema).min(5),
    criticalCues: z
      .array(
        audioCueSchema.extend({
          fallbackTextKey: z.string().min(1),
          fallbackIconKey: z.string().min(1),
        }),
      )
      .min(1),
    requiredSfxFamilies: z.array(z.string().min(1)).min(8),
  })
  .loose();

export interface PreflightResult {
  readonly errors: readonly string[];
  readonly passed: readonly string[];
  readonly blocked: readonly string[];
}

export function runPreflight(
  repositoryRoot: string,
  evidencePath: string,
  knownIssuesPath: string,
  externalBlockersPath: string,
  strict: boolean,
  expectedCandidate?: { readonly version: string; readonly commit: string },
): PreflightResult {
  let evidence: z.infer<typeof evidenceSchema>;
  try {
    evidence = evidenceSchema.parse(JSON.parse(readFileSync(evidencePath, "utf8")) as unknown);
  } catch (error) {
    return { errors: [`Invalid release evidence: ${String(error)}`], passed: [], blocked: [] };
  }

  const errors: string[] = [];
  const passed: string[] = [];
  const blocked: string[] = [];
  const ids = new Set(evidence.gates.map((gate) => gate.id));
  for (const id of requiredGateIds) {
    if (!ids.has(id)) errors.push(`Release evidence is missing gate: ${id}`);
  }
  if (ids.size !== evidence.gates.length)
    errors.push("Release evidence contains duplicate gate IDs");

  const knownIssues = readFileSync(knownIssuesPath, "utf8");
  const openIssues = knownIssues.split("## Closed", 1)[0] ?? knownIssues;
  if (/\|\s*[^|]+\|\s*P[01]\s*\|/.test(openIssues)) {
    errors.push("Open P0 or P1 issue blocks the release");
  }
  const externalBlockers = readFileSync(externalBlockersPath, "utf8");

  for (const gate of evidence.gates) {
    for (const path of gate.evidence) {
      const absolutePath = safeRepositoryPath(repositoryRoot, path);
      if (absolutePath === undefined || !existsSync(absolutePath)) {
        errors.push(`Release evidence path is missing or unsafe for ${gate.id}: ${path}`);
      }
    }
    if (gate.id === "complete-audio") {
      validateAudioCatalog(repositoryRoot, gate.evidence, gate.status === "passed", errors);
    }
    if (gate.status === "passed") {
      passed.push(gate.id);
      continue;
    }
    blocked.push(gate.id);
    for (const blockerId of gate.blockerIds) {
      if (!externalBlockers.includes(`| ${blockerId} `)) {
        errors.push(`Release gate ${gate.id} cites an unknown blocker: ${blockerId}`);
      }
    }
    if (strict)
      errors.push(`Release gate is not passed: ${gate.id} (${gate.blockerIds.join(", ")})`);
  }

  if (strict && (evidence.candidateVersion === null || evidence.candidateCommit === null)) {
    errors.push("Strict release gate requires an immutable candidate version and commit");
  }
  if (strict && expectedCandidate === undefined)
    errors.push("Strict release gate requires the workflow candidate version and commit");
  if (
    strict &&
    expectedCandidate !== undefined &&
    (evidence.candidateVersion !== expectedCandidate.version ||
      evidence.candidateCommit !== expectedCandidate.commit)
  )
    errors.push("Release evidence candidate identity does not match the workflow ref");
  return { errors, passed, blocked };
}

function validateAudioCatalog(
  repositoryRoot: string,
  evidencePaths: readonly string[],
  requireReady: boolean,
  errors: string[],
): void {
  const catalogEvidence = evidencePaths.find((path) => path.endsWith("audio-catalog.json"));
  if (catalogEvidence === undefined) {
    if (requireReady) errors.push("Passed complete-audio gate must reference audio-catalog.json");
    return;
  }
  const catalogPath = safeRepositoryPath(repositoryRoot, catalogEvidence);
  if (catalogPath === undefined || !existsSync(catalogPath)) return;
  let catalog: z.infer<typeof audioCatalogSchema>;
  try {
    catalog = audioCatalogSchema.parse(JSON.parse(readFileSync(catalogPath, "utf8")) as unknown);
  } catch (error) {
    errors.push(`Invalid release audio catalog: ${String(error)}`);
    return;
  }
  if (requireReady && catalog.releaseStatus !== "ready") {
    errors.push("Passed complete-audio gate requires a ready catalog");
  }
  const missingAssetCues = [...catalog.music, ...catalog.criticalCues]
    .filter((cue) => cue.assetId === null)
    .map((cue) => cue.cueId);
  if (requireReady && missingAssetCues.length > 0) {
    errors.push(
      `Release audio cues are missing approved asset IDs: ${missingAssetCues.join(", ")}`,
    );
  }
}

function safeRepositoryPath(repositoryRoot: string, path: string): string | undefined {
  if (isAbsolute(path)) return undefined;
  const absolutePath = resolve(repositoryRoot, path);
  const relativePath = relative(repositoryRoot, absolutePath);
  return relativePath.startsWith("..") || isAbsolute(relativePath) ? undefined : absolutePath;
}
