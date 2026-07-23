import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { ContentWorkspace, GatewayError } from "./workspace.js";

export interface ContentRollbackDrillResult {
  readonly originalPublicationId: string;
  readonly replacementPublicationId: string;
  readonly restoredPublicationId: string;
  readonly freezeEnforced: boolean;
}

export async function runContentRollbackDrill(
  repositoryRoot: string,
): Promise<ContentRollbackDrillResult> {
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "skymenders-rollback-drill-"));
  try {
    await cp(resolve(repositoryRoot, "content"), resolve(temporaryRoot, "content"), {
      recursive: true,
    });
    const workspace = new ContentWorkspace({ rootDirectory: temporaryRoot });
    const original = await publish(workspace, "drill000", "release.drill.original");

    const localization = await workspace.readCatalog("localization");
    await workspace.saveCatalog(
      "localization",
      localization.revision,
      {
        ...(localization.data as Record<string, string>),
        "ui.release.rollback_drill": "内容回滚演练",
      },
      "release.drill.author",
    );
    const replacement = await publish(workspace, "drill001", "release.drill.replacement");
    const rolledBack = await workspace.rollback(
      replacement.id,
      original.id,
      "release.drill.operator",
      `${replacement.id}:${original.id}`,
    );
    const restoredPublicationId = await workspace.currentPublicationId();
    if (rolledBack.state !== "rolled_back" || restoredPublicationId !== original.id)
      throw new Error("content rollback did not restore the original immutable publication");

    await workspace.freeze("0.2.0", "Phase 11 rollback drill freeze", "release.drill.operator");
    let freezeEnforced = false;
    try {
      await workspace.saveCatalog(
        "localization",
        localization.revision,
        localization.data,
        "release.drill.author",
      );
    } catch (error) {
      freezeEnforced = error instanceof GatewayError && error.code === "CONTENT_FROZEN";
    }
    if (!freezeEnforced) throw new Error("content freeze did not reject a post-freeze write");

    return {
      originalPublicationId: original.id,
      replacementPublicationId: replacement.id,
      restoredPublicationId,
      freezeEnforced,
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function publish(workspace: ContentWorkspace, commitSha: string, actor: string) {
  const record = await workspace.buildPublication({ actor, rulesVersion: "0.6.0", commitSha });
  await workspace.stagePublication(record.id, actor);
  await workspace.approvePublication(record.id, "release.drill.reviewer");
  await workspace.signPublication(
    record.id,
    "release.drill.signer",
    "phase-eleven-local-drill-signing-material-only",
  );
  return workspace.publish(record.id, "release.drill.operator", record.id);
}
