import { z } from "zod/v3";

import { expeditionSaveDocumentSchema } from "@skymenders/protocol/account-save";
import type { ExpeditionSaveDocument } from "@skymenders/protocol/account-save";

import type { AuthSessionManager } from "../account/AuthSessionManager";
import type { CloudSaveConflict, CloudSaveGateway, SaveSummary } from "./CloudSaveCoordinator";

const summarySchema = z
  .object({
    saveId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    logicalClock: z.number().int().nonnegative(),
    updatedAt: z.string().datetime({ offset: true }),
    contentVersion: z.string(),
    rulesVersion: z.string(),
    summary: expeditionSaveDocumentSchema.shape.summary,
  })
  .strict();

const conflictSchema = z
  .object({
    error: z
      .object({
        code: z.literal("SAVE_CONFLICT"),
        details: z.object({ local: summarySchema.nullable(), cloud: summarySchema.nullable() }),
      })
      .passthrough(),
  })
  .passthrough();

export class HttpCloudSaveGateway implements CloudSaveGateway {
  public constructor(private readonly sessions: AuthSessionManager) {}

  public async put(
    baseRevision: number | null,
    document: ExpeditionSaveDocument,
    idempotencyKey: string,
  ): Promise<ExpeditionSaveDocument | CloudSaveConflict> {
    const response = await this.sessions.authorizedRequest({
      method: "PUT",
      path: "/v1/saves/expedition",
      headers: { "idempotency-key": idempotencyKey },
      body: { baseRevision, document },
    });
    if (response.status === 409) {
      const conflict = conflictSchema.parse(response.body).error.details;
      return { kind: "conflict", local: conflict.local, cloud: conflict.cloud };
    }
    return parseSaveResponse(response.status, response.body);
  }

  public async resolve(
    choice: "local" | "cloud",
    expectedCloudRevision: number,
    localDocument: ExpeditionSaveDocument | null,
    idempotencyKey: string,
  ): Promise<ExpeditionSaveDocument> {
    const response = await this.sessions.authorizedRequest({
      method: "POST",
      path: "/v1/saves/resolve-conflict",
      headers: { "idempotency-key": idempotencyKey },
      body: { choice, expectedCloudRevision, localDocument },
    });
    return parseSaveResponse(response.status, response.body);
  }
}

function parseSaveResponse(status: number, body: unknown): ExpeditionSaveDocument {
  if (status < 200 || status >= 300)
    throw new Error(`cloud save request failed with status ${status}`);
  return expeditionSaveDocumentSchema.parse(body);
}

export function toSaveSummary(document: ExpeditionSaveDocument): SaveSummary {
  return summarySchema.parse({
    saveId: document.saveId,
    revision: document.revision,
    logicalClock: document.logicalClock,
    updatedAt: document.updatedAt,
    contentVersion: document.contentVersion,
    rulesVersion: document.rulesVersion,
    summary: document.summary,
  });
}
