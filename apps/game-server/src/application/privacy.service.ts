import { Inject, Injectable } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";

import { privacyDeleteRequestSchema } from "@skymenders/protocol";
import type { PrivacyRequestResponse } from "@skymenders/protocol";

import { GAME_REPOSITORY, SERVER_CLOCK } from "../core/contracts.js";
import type { GameRepository, PrivacyRecord, ServerClock } from "../core/contracts.js";
import { ApiError } from "../http/api-error.js";

@Injectable()
export class PrivacyService {
  public constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

  public async export(accountId: string) {
    const request = await this.create(accountId, "export");
    const data = await this.repository.exportAccount(accountId);
    if (data === null) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "The account does not exist");
    const completed = await this.repository.updatePrivacyRequest(
      request.requestId,
      "completed",
      this.clock.now(),
    );
    return { request: publicRecord(completed), data };
  }

  public async delete(accountId: string, input: unknown): Promise<PrivacyRequestResponse> {
    privacyDeleteRequestSchema.parse(input);
    const request = await this.create(accountId, "delete");
    const now = this.clock.now();
    await this.repository.revokeAllSessions(accountId, now);
    await this.repository.hardDeleteAccount(accountId);
    const completed = await this.repository.updatePrivacyRequest(
      request.requestId,
      "completed",
      now,
    );
    return publicRecord(completed);
  }

  public async status(accountId: string, requestId: string): Promise<PrivacyRequestResponse> {
    const record = await this.repository.getPrivacyRequest(accountId, requestId);
    if (record === null)
      throw new ApiError(404, "PRIVACY_REQUEST_NOT_FOUND", "The privacy request does not exist");
    return publicRecord(record);
  }

  private async create(accountId: string, kind: "export" | "delete"): Promise<PrivacyRecord> {
    const now = this.clock.now();
    const record: PrivacyRecord = {
      requestId: uuidv7({ msecs: now.getTime() }),
      accountId,
      kind,
      status: "processing",
      createdAt: now.toISOString(),
      completedAt: null,
    };
    await this.repository.createPrivacyRequest(record);
    return record;
  }
}

function publicRecord(record: PrivacyRecord): PrivacyRequestResponse {
  return {
    requestId: record.requestId,
    kind: record.kind,
    status: record.status,
    createdAt: record.createdAt,
    completedAt: record.completedAt,
  };
}
