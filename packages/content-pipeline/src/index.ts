import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  generateExpeditionPlan,
  findTargetDurationPath,
  validateAuthoredMaps,
} from "@skymenders/content-runtime";
import {
  catalogSchemas,
  formatZodIssues,
  localizationCatalogSchema,
  validateContentPack,
} from "@skymenders/content-schema";
import type { ContentIssue, ContentPackReport, PveContentPack } from "@skymenders/content-schema";
import { canonicalStringify } from "@skymenders/deterministic-runtime";

export const CONTENT_FILE_DESCRIPTORS = [
  ["robots", "robots/catalog.json"],
  ["modules", "modules/catalog.json"],
  ["enemies", "enemies/catalog.json"],
  ["bosses", "bosses/catalog.json"],
  ["objectives", "objectives/catalog.json"],
  ["maps", "maps/catalog.json"],
  ["regions", "regions/catalog.json"],
  ["events", "events/catalog.json"],
  ["routes", "routes/catalog.json"],
  ["tutorials", "tutorials/catalog.json"],
  ["progression", "progression/catalog.json"],
  ["localization", "localization/zh-CN.json"],
] as const;

export type ContentCatalogKey = (typeof CONTENT_FILE_DESCRIPTORS)[number][0];
export type ContentFilePath = (typeof CONTENT_FILE_DESCRIPTORS)[number][1];

export interface ContentSnapshotParseResult {
  readonly pack?: PveContentPack;
  readonly report: ContentPackReport;
}

export interface SimulationReport {
  readonly seedCount: number;
  readonly passed: number;
  readonly failedSeeds: readonly number[];
  readonly minimumMinutes: number | null;
  readonly maximumMinutes: number | null;
}

export interface PublicationEvaluation {
  readonly valid: boolean;
  readonly report: ContentPackReport;
  readonly simulation: SimulationReport;
  readonly artifactHash: string;
}

export interface PublicationManifest {
  readonly schemaVersion: "1.0.0";
  readonly contentVersion: string;
  readonly rulesVersion: string;
  readonly artifactHash: string;
  readonly commitSha: string;
  readonly createdAt: string;
  readonly catalogHashes: Readonly<Record<ContentCatalogKey, string>>;
  readonly counts: Readonly<Record<string, number>>;
  readonly simulation: SimulationReport;
}

export interface PublicationArtifact {
  readonly manifest: PublicationManifest;
  readonly payload: string;
}

export interface ContentDifference {
  readonly path: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

export const PUBLICATION_STATES = [
  "draft",
  "validated",
  "staged",
  "approved",
  "signed",
  "published",
  "rolled_back",
] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

const TRANSITIONS: Readonly<Record<PublicationState, readonly PublicationState[]>> = {
  draft: ["validated"],
  validated: ["staged"],
  staged: ["approved"],
  approved: ["signed"],
  signed: ["published"],
  published: ["rolled_back"],
  rolled_back: [],
};

export function parseContentSnapshot(
  files: Readonly<Partial<Record<ContentFilePath, unknown>>>,
): ContentSnapshotParseResult {
  const issues: ContentIssue[] = [];
  const parsed: Partial<Record<ContentCatalogKey, unknown>> = {};
  for (const [key, path] of CONTENT_FILE_DESCRIPTORS) {
    const value = files[path];
    if (value === undefined) {
      issues.push({ code: "CONTENT_FILE_MISSING", path, message: "required catalog is missing" });
      continue;
    }
    const result =
      key === "localization"
        ? localizationCatalogSchema.safeParse(value)
        : catalogSchemas[key].safeParse(value);
    if (!result.success) {
      issues.push(
        ...formatZodIssues(result.error).map((issue) => ({
          ...issue,
          path: `${path}:${issue.path}`,
        })),
      );
      continue;
    }
    parsed[key] = result.data;
  }
  if (issues.length > 0) return { report: emptyReport(issues) };
  const pack = parsed as unknown as PveContentPack;
  return { pack, report: validateContentPack(pack) };
}

export function evaluatePublication(
  pack: PveContentPack,
  seeds: readonly number[] = DEFAULT_SIMULATION_SEEDS,
): PublicationEvaluation {
  const base = validateContentPack(pack);
  const issues = [...base.issues];
  for (const map of validateAuthoredMaps(pack)) {
    for (const issue of map.issues) {
      if (issue.severity === "error") {
        issues.push({
          code: `MAP_${issue.code}`,
          path: `maps.${map.mapId}.${issue.path}`,
          message: issue.message,
        });
      }
    }
  }
  const simulation = simulateRoutes(pack, seeds);
  for (const seed of simulation.failedSeeds) {
    issues.push({
      code: "ROUTE_SIMULATION_FAILED",
      path: `routes.seed.${seed}`,
      message: "no complete route inside the configured target duration",
    });
  }
  issues.sort(
    (left, right) => left.code.localeCompare(right.code) || left.path.localeCompare(right.path),
  );
  const report = { ...base, valid: issues.length === 0, issues };
  return {
    valid: report.valid,
    report,
    simulation,
    artifactHash: sha256(canonicalStringify(pack)),
  };
}

export function createPublicationArtifact(input: {
  readonly pack: PveContentPack;
  readonly rulesVersion: string;
  readonly commitSha: string;
  readonly createdAt: string;
  readonly seeds?: readonly number[];
}): PublicationArtifact {
  const evaluation = evaluatePublication(input.pack, input.seeds ?? DEFAULT_SIMULATION_SEEDS);
  if (!evaluation.valid) {
    throw new ContentPublicationError("CONTENT_INVALID", evaluation.report.issues);
  }
  const catalogs = contentPackEntries(input.pack);
  const catalogHashes = Object.fromEntries(
    catalogs.map(([key, value]) => [key, sha256(canonicalStringify(value))]),
  ) as Record<ContentCatalogKey, string>;
  const contentVersion = input.pack.robots.contentVersion;
  const manifest: PublicationManifest = {
    schemaVersion: "1.0.0",
    contentVersion,
    rulesVersion: input.rulesVersion,
    artifactHash: evaluation.artifactHash,
    commitSha: input.commitSha,
    createdAt: input.createdAt,
    catalogHashes,
    counts: evaluation.report.counts,
    simulation: evaluation.simulation,
  };
  return { manifest, payload: canonicalStringify({ manifest, content: input.pack }) };
}

export function transitionPublication(
  from: PublicationState,
  to: PublicationState,
): PublicationState {
  if (!TRANSITIONS[from].includes(to)) {
    throw new ContentPublicationError("PUBLICATION_TRANSITION_INVALID", [
      { code: "PUBLICATION_TRANSITION_INVALID", path: "state", message: `${from} -> ${to}` },
    ]);
  }
  return to;
}

export function signArtifact(artifactHash: string, secret: string): string {
  if (secret.length < 32) throw new Error("content signing secret must be at least 32 characters");
  return createHmac("sha256", secret).update(artifactHash, "utf8").digest("hex");
}

export function verifyArtifactSignature(
  artifactHash: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signArtifact(artifactHash, secret);
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

export function diffContent(
  before: unknown,
  after: unknown,
  limit = 500,
): readonly ContentDifference[] {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("diff limit must be positive");
  const result: ContentDifference[] = [];
  collectDifferences(before, after, "$", result, limit);
  return result;
}

export class ContentPublicationError extends Error {
  public constructor(
    public readonly code: string,
    public readonly issues: readonly ContentIssue[],
  ) {
    super(code);
    this.name = "ContentPublicationError";
  }
}

const DEFAULT_SIMULATION_SEEDS = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144] as const;

function simulateRoutes(pack: PveContentPack, seeds: readonly number[]): SimulationReport {
  const durations: number[] = [];
  const failedSeeds: number[] = [];
  for (const seed of Array.from(new Set(seeds)).sort((left, right) => left - right)) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
      failedSeeds.push(seed);
      continue;
    }
    try {
      const path = findTargetDurationPath(pack, generateExpeditionPlan(pack, seed));
      if (path === null) failedSeeds.push(seed);
      else durations.push(path.estimatedMinutes);
    } catch {
      failedSeeds.push(seed);
    }
  }
  return {
    seedCount: new Set(seeds).size,
    passed: durations.length,
    failedSeeds,
    minimumMinutes: durations.length === 0 ? null : Math.min(...durations),
    maximumMinutes: durations.length === 0 ? null : Math.max(...durations),
  };
}

function contentPackEntries(
  pack: PveContentPack,
): readonly (readonly [ContentCatalogKey, unknown])[] {
  return CONTENT_FILE_DESCRIPTORS.map(([key]) => [key, pack[key]] as const);
}

function collectDifferences(
  before: unknown,
  after: unknown,
  path: string,
  output: ContentDifference[],
  limit: number,
): void {
  if (output.length >= limit || Object.is(before, after)) return;
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length && output.length < limit; index += 1)
      collectDifferences(before[index], after[index], `${path}[${index}]`, output, limit);
    return;
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
    for (const key of keys) {
      if (output.length >= limit) break;
      collectDifferences(before[key], after[key], `${path}.${key}`, output, limit);
    }
    return;
  }
  const difference: { path: string; before?: unknown; after?: unknown } = { path };
  if (before !== undefined) difference.before = before;
  if (after !== undefined) difference.after = after;
  output.push(difference);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function emptyReport(issues: readonly ContentIssue[]): ContentPackReport {
  return { valid: false, issues, counts: {} };
}
