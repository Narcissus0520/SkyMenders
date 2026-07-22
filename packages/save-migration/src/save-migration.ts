import { canonicalClone, hashCanonical, verifySnapshot } from "@skymenders/deterministic-runtime";
import type { CanonicalValue, RuntimeSnapshot } from "@skymenders/deterministic-runtime";
import {
  SAVE_SCHEMA_VERSION,
  accountProgressSaveSchema,
  expeditionSaveDocumentSchema,
} from "@skymenders/protocol";
import type {
  AccountProgressSave,
  ExpeditionSaveDocument,
  RuntimeSnapshotDocument,
} from "@skymenders/protocol";
import { z } from "zod";

type JsonValue = z.infer<ReturnType<typeof z.json>>;

export interface SaveCompatibility {
  readonly rulesVersion: string;
  readonly contentVersion: string;
  readonly replaySchemaVersion: string;
}

export interface RecoveryResult {
  readonly document: ExpeditionSaveDocument;
  readonly source: "battle_turn" | "node_start" | "expedition";
  readonly recoveredState: JsonValue | null;
  readonly warnings: readonly string[];
}

export interface ConflictResolution {
  readonly authoritative: ExpeditionSaveDocument;
  readonly archived: ExpeditionSaveDocument;
}

const legacyExpeditionSaveV001Schema = z
  .object({
    saveSchemaVersion: z.literal("0.0.1"),
    saveId: z.uuid(),
    updatedAt: z.iso.datetime({ offset: true }),
    contentVersion: z.string(),
    rulesVersion: z.string(),
    expedition: expeditionSaveDocumentSchema.shape.expedition,
    summary: expeditionSaveDocumentSchema.shape.summary,
  })
  .strict();

export type LegacyExpeditionSaveV001 = z.infer<typeof legacyExpeditionSaveV001Schema>;

type UnsealedSave = Omit<ExpeditionSaveDocument, "integrityHash">;

export function sealExpeditionSave(input: UnsealedSave): ExpeditionSaveDocument {
  const detached = canonicalClone(input as unknown as CanonicalValue) as unknown as UnsealedSave;
  return verifyExpeditionSave({
    ...detached,
    integrityHash: hashCanonical(detached),
  });
}

export function verifyExpeditionSave(input: unknown): ExpeditionSaveDocument {
  const document = expeditionSaveDocumentSchema.parse(input);
  const { integrityHash, ...unsigned } = document;
  const actualHash = hashCanonical(unsigned);
  if (actualHash !== integrityHash)
    throw new Error(`save integrity mismatch: expected ${integrityHash}, received ${actualHash}`);
  if (
    document.contentVersion !== document.expedition.plan.contentVersion ||
    document.rulesVersion !== document.expedition.plan.rulesVersion
  )
    throw new Error("save version dimensions do not match the expedition plan");
  if (
    document.summary.regionIndex !== document.expedition.regionIndex ||
    document.summary.layer !== document.expedition.layer ||
    document.summary.completedNodes !== document.expedition.completedNodeIds.length
  )
    throw new Error("save summary does not match the expedition state");
  if (
    new Set(document.expedition.restartUsedNodeIds).size !==
    document.expedition.restartUsedNodeIds.length
  )
    throw new Error("restart ledger contains duplicate node ids");
  return canonicalClone(document as unknown as CanonicalValue) as unknown as ExpeditionSaveDocument;
}

export function migrateExpeditionSave(
  input: unknown,
  deviceKind: ExpeditionSaveDocument["deviceKind"] = "unknown",
): ExpeditionSaveDocument {
  const current = expeditionSaveDocumentSchema.safeParse(input);
  if (current.success) return verifyExpeditionSave(current.data);
  const legacy = legacyExpeditionSaveV001Schema.safeParse(input);
  if (!legacy.success) throw new Error("unsupported or invalid expedition save schema");
  return sealExpeditionSave({
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    saveId: legacy.data.saveId,
    revision: 0,
    logicalClock: 0,
    deviceKind,
    updatedAt: legacy.data.updatedAt,
    contentVersion: legacy.data.contentVersion,
    rulesVersion: legacy.data.rulesVersion,
    expedition: legacy.data.expedition,
    nodeStartSnapshot: null,
    battleTurnSnapshot: null,
    summary: legacy.data.summary,
  });
}

export function recoverExpeditionSave(
  input: unknown,
  compatibility: SaveCompatibility,
): RecoveryResult {
  const document = migrateExpeditionSave(input);
  if (
    document.rulesVersion !== compatibility.rulesVersion ||
    document.contentVersion !== compatibility.contentVersion
  )
    throw new Error("save requires an unavailable rules or content version");
  const warnings: string[] = [];
  const battle = restore(document.battleTurnSnapshot, compatibility, "battle turn", warnings);
  if (battle !== null) return { document, source: "battle_turn", recoveredState: battle, warnings };
  const node = restore(document.nodeStartSnapshot, compatibility, "node start", warnings);
  if (node !== null) return { document, source: "node_start", recoveredState: node, warnings };
  return { document, source: "expedition", recoveredState: null, warnings };
}

function restore(
  snapshot: RuntimeSnapshotDocument | null,
  compatibility: SaveCompatibility,
  label: string,
  warnings: string[],
): JsonValue | null {
  if (snapshot === null) return null;
  try {
    return verifySnapshot(
      snapshot as unknown as RuntimeSnapshot<CanonicalValue>,
      compatibility,
    ) as JsonValue;
  } catch (error) {
    warnings.push(`${label} snapshot rejected: ${errorMessage(error)}`);
    return null;
  }
}

export function consumeNodeRestart(
  input: ExpeditionSaveDocument,
  nodeId: string,
  updatedAt: string,
): ExpeditionSaveDocument {
  const document = verifyExpeditionSave(input);
  if (!/^[a-z][a-z0-9_]*$/.test(nodeId)) throw new Error("restart node id is invalid");
  if (document.expedition.restartUsedNodeIds.includes(nodeId))
    throw new Error(`node restart already consumed: ${nodeId}`);
  return sealExpeditionSave({
    ...withoutIntegrity(document),
    revision: document.revision + 1,
    logicalClock: document.logicalClock + 1,
    updatedAt,
    expedition: {
      ...document.expedition,
      restartUsedNodeIds: [...document.expedition.restartUsedNodeIds, nodeId],
    },
  });
}

export function resolveExpeditionConflict(
  localInput: ExpeditionSaveDocument,
  cloudInput: ExpeditionSaveDocument,
  choice: "local" | "cloud",
  updatedAt: string,
): ConflictResolution {
  const local = verifyExpeditionSave(localInput);
  const cloud = verifyExpeditionSave(cloudInput);
  if (local.saveId !== cloud.saveId) throw new Error("cannot resolve saves with different ids");
  const selected = choice === "local" ? local : cloud;
  const rejected = choice === "local" ? cloud : local;
  const authoritative = sealExpeditionSave({
    ...withoutIntegrity(selected),
    revision: Math.max(local.revision, cloud.revision) + 1,
    logicalClock: Math.max(local.logicalClock, cloud.logicalClock) + 1,
    updatedAt,
  });
  return { authoritative, archived: rejected };
}

export function mergeAccountProgress(
  localInput: AccountProgressSave,
  cloudInput: AccountProgressSave,
  updatedAt: string,
): AccountProgressSave {
  const local = accountProgressSaveSchema.parse(localInput);
  const cloud = accountProgressSaveSchema.parse(cloudInput);
  const latest = local.logicalClock >= cloud.logicalClock ? local : cloud;
  const metricKeys = new Set([...Object.keys(local.statistics), ...Object.keys(cloud.statistics)]);
  return accountProgressSaveSchema.parse({
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    logicalClock: Math.max(local.logicalClock, cloud.logicalClock) + 1,
    updatedAt,
    unlockIds: union(local.unlockIds, cloud.unlockIds),
    achievementIds: union(local.achievementIds, cloud.achievementIds),
    compendiumEntryIds: union(local.compendiumEntryIds, cloud.compendiumEntryIds),
    completedTutorialIds: union(local.completedTutorialIds, cloud.completedTutorialIds),
    settings: latest.settings,
    statistics: Object.fromEntries(
      [...metricKeys]
        .sort()
        .map((key) => [key, Math.max(local.statistics[key] ?? 0, cloud.statistics[key] ?? 0)]),
    ),
  });
}

function withoutIntegrity(document: ExpeditionSaveDocument): UnsealedSave {
  const { integrityHash, ...unsigned } = document;
  void integrityHash;
  return unsigned;
}

function union(left: readonly string[], right: readonly string[]): string[] {
  return [...new Set([...left, ...right])].sort();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
