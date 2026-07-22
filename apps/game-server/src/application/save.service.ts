import { Inject, Injectable } from "@nestjs/common";

import {
  accountProgressSaveSchema,
  putExpeditionSaveRequestSchema,
  resolveSaveConflictRequestSchema,
} from "@skymenders/protocol";
import type { AccountProgressSave, ExpeditionSaveDocument } from "@skymenders/protocol";
import {
  mergeAccountProgress,
  resolveExpeditionConflict,
  sealExpeditionSave,
  verifyExpeditionSave,
} from "@skymenders/save-migration";

import { GAME_REPOSITORY, SERVER_CLOCK } from "../core/contracts.js";
import type { GameRepository, ServerClock } from "../core/contracts.js";
import { ApiError } from "../http/api-error.js";

const RECOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class SaveService {
  public constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

  public async getExpedition(accountId: string): Promise<ExpeditionSaveDocument | null> {
    return this.repository.getExpeditionSave(accountId);
  }

  public async putExpedition(accountId: string, input: unknown): Promise<ExpeditionSaveDocument> {
    const request = putExpeditionSaveRequestSchema.parse(input);
    const incoming = verifyExpeditionSave(request.document);
    const cloud = await this.repository.getExpeditionSave(accountId);
    const currentRevision = cloud?.revision ?? null;
    if (request.baseRevision !== currentRevision)
      throw conflict(incoming, cloud, "The cloud save changed after this device last synchronized");
    if (cloud !== null && cloud.saveId !== incoming.saveId)
      throw conflict(incoming, cloud, "The device and cloud saves are different expeditions");
    const now = this.clock.now();
    const authoritative = sealExpeditionSave({
      ...unsigned(incoming),
      revision: cloud === null ? 0 : cloud.revision + 1,
      logicalClock: Math.max(incoming.logicalClock, cloud?.logicalClock ?? -1) + 1,
      updatedAt: now.toISOString(),
    });
    const committed = await this.repository.commitExpeditionSave(
      accountId,
      currentRevision,
      authoritative,
      cloud === null ? null : this.archiveInput("superseded", cloud, now),
    );
    if (!committed)
      throw conflict(
        incoming,
        await this.repository.getExpeditionSave(accountId),
        "The cloud save changed while this upload was being committed",
      );
    return authoritative;
  }

  public async resolveConflict(accountId: string, input: unknown): Promise<ExpeditionSaveDocument> {
    const request = resolveSaveConflictRequestSchema.parse(input);
    const cloud = await this.repository.getExpeditionSave(accountId);
    if (cloud === null)
      throw new ApiError(404, "CLOUD_SAVE_NOT_FOUND", "There is no cloud expedition to resolve");
    if (cloud.revision !== request.expectedCloudRevision)
      throw conflict(
        request.localDocument,
        cloud,
        "The cloud save changed during conflict resolution",
      );
    if (request.localDocument === null) return cloud;
    const now = this.clock.now();
    const resolved = resolveExpeditionConflict(
      request.localDocument,
      cloud,
      request.choice,
      now.toISOString(),
    );
    const committed = await this.repository.commitExpeditionSave(
      accountId,
      cloud.revision,
      resolved.authoritative,
      this.archiveInput("conflict", resolved.archived, now),
    );
    if (!committed)
      throw conflict(
        request.localDocument,
        await this.repository.getExpeditionSave(accountId),
        "The cloud save changed while the conflict choice was being committed",
      );
    return resolved.authoritative;
  }

  public async deleteExpedition(accountId: string): Promise<{ readonly deleted: true }> {
    const cloud = await this.repository.getExpeditionSave(accountId);
    if (cloud !== null) await this.archive(accountId, "deleted", cloud, this.clock.now());
    await this.repository.deleteExpeditionSave(accountId);
    return { deleted: true };
  }

  public async getProgress(accountId: string): Promise<AccountProgressSave> {
    const progress = await this.repository.getProgress(accountId);
    if (progress === null)
      throw new ApiError(404, "PROGRESS_NOT_FOUND", "The account progress save does not exist");
    return progress;
  }

  public async mergeProgress(accountId: string, input: unknown): Promise<AccountProgressSave> {
    const incoming = accountProgressSaveSchema.parse(input);
    const cloud = await this.getProgress(accountId);
    const merged = mergeAccountProgress(incoming, cloud, this.clock.now().toISOString());
    await this.repository.putProgress(accountId, merged);
    return merged;
  }

  private async archive(
    accountId: string,
    kind: "superseded" | "conflict" | "deleted",
    document: ExpeditionSaveDocument,
    now: Date,
  ): Promise<void> {
    const archive = this.archiveInput(kind, document, now);
    await this.repository.archiveSave(accountId, archive.kind, archive.document, archive.expiresAt);
  }

  private archiveInput(
    kind: "superseded" | "conflict" | "deleted",
    document: ExpeditionSaveDocument,
    now: Date,
  ) {
    return { kind, document, expiresAt: new Date(now.getTime() + RECOVERY_TTL_MS) } as const;
  }
}

function conflict(
  local: ExpeditionSaveDocument | null,
  cloud: ExpeditionSaveDocument | null,
  message: string,
): ApiError {
  return new ApiError(409, "SAVE_CONFLICT", message, {
    local: local === null ? null : summary(local),
    cloud: cloud === null ? null : summary(cloud),
  });
}

function summary(document: ExpeditionSaveDocument) {
  return {
    saveId: document.saveId,
    revision: document.revision,
    logicalClock: document.logicalClock,
    updatedAt: document.updatedAt,
    contentVersion: document.contentVersion,
    rulesVersion: document.rulesVersion,
    summary: document.summary,
  };
}

function unsigned(document: ExpeditionSaveDocument) {
  const { integrityHash, ...rest } = document;
  void integrityHash;
  return rest;
}
