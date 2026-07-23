import { readFile } from "node:fs/promises";

import type { ExpeditionSaveDocument } from "@skymenders/protocol";
import { canonicalStringify } from "@skymenders/deterministic-runtime";

import {
  migrateExpeditionSave,
  recoverExpeditionSave,
  verifyExpeditionSave,
} from "./save-migration.js";

export interface MigrationDrillCase {
  readonly path: string;
  readonly sourceSchemaVersion: string;
  readonly resultIntegrityHash: string;
}

export async function runSaveMigrationDrill(
  fixturePaths: readonly string[],
): Promise<readonly MigrationDrillCase[]> {
  if (fixturePaths.length === 0) throw new Error("save migration drill requires fixtures");
  const results: MigrationDrillCase[] = [];
  for (const path of fixturePaths) {
    const source = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    const migrated = migrateExpeditionSave(source);
    assertPreserved(source, migrated);
    verifyExpeditionSave(migrated);
    const recovery = recoverExpeditionSave(migrated, {
      rulesVersion: "0.6.0",
      contentVersion: "0.2.0",
      replaySchemaVersion: "0.1.0",
      supportedVersionPairs: [{ rulesVersion: "0.5.0", contentVersion: "0.1.0" }],
    });
    if (recovery.source !== "expedition" || recovery.warnings.length !== 0)
      throw new Error(`unexpected recovery result for migration fixture: ${path}`);
    results.push({
      path,
      sourceSchemaVersion: String(source.saveSchemaVersion),
      resultIntegrityHash: migrated.integrityHash,
    });
  }
  return results;
}

function assertPreserved(source: Record<string, unknown>, migrated: ExpeditionSaveDocument): void {
  if (
    source.saveId !== migrated.saveId ||
    source.contentVersion !== migrated.contentVersion ||
    source.rulesVersion !== migrated.rulesVersion ||
    canonicalStringify(source.expedition) !== canonicalStringify(migrated.expedition) ||
    canonicalStringify(source.summary) !== canonicalStringify(migrated.summary)
  )
    throw new Error("save migration changed authoritative progress or compatibility dimensions");
}
