import {
  abandonDailyAttemptResponseSchema,
  dailyAttemptCheckpointRequestSchema,
  dailyAttemptCheckpointResponseSchema,
  dailyAttemptStartResponseSchema,
  dailyAttemptSubmissionResponseSchema,
  dailyChallengeResponseSchema,
  dailyLeaderboardMeSchema,
  dailyLeaderboardPageSchema,
  finishDailyAttemptRequestSchema,
} from "@skymenders/protocol";
import type {
  DailyAttemptCheckpointRequest,
  DailyAttemptCheckpointResponse,
  DailyAttemptStartResponse,
  DailyAttemptSubmissionResponse,
  DailyChallengeResponse,
  DailyLeaderboardMe,
  DailyLeaderboardPage,
  FinishDailyAttemptRequest,
} from "@skymenders/protocol";
import type { ZodType } from "zod/v3";

import type { AuthSessionManager, JsonRequest } from "../account/AuthSessionManager";

export class DailyChallengeClient {
  public constructor(private readonly sessions: AuthSessionManager) {}

  public getDaily(): Promise<DailyChallengeResponse> {
    return this.request(
      { method: "GET", path: "/v1/challenges/daily" },
      dailyChallengeResponseSchema,
    );
  }

  public startPractice(idempotencyKey: string): Promise<DailyAttemptStartResponse> {
    return this.start("practice", idempotencyKey);
  }

  public startFormal(idempotencyKey: string): Promise<DailyAttemptStartResponse> {
    return this.start("attempts", idempotencyKey);
  }

  public checkpoint(
    attemptId: string,
    checkpointInput: DailyAttemptCheckpointRequest,
    idempotencyKey: string,
  ): Promise<DailyAttemptCheckpointResponse> {
    const checkpoint = dailyAttemptCheckpointRequestSchema.parse(checkpointInput);
    return this.request(
      {
        method: "PUT",
        path: `/v1/challenges/daily/attempts/${encodeURIComponent(attemptId)}/checkpoint`,
        headers: idempotency(idempotencyKey),
        body: checkpoint,
      },
      dailyAttemptCheckpointResponseSchema,
    );
  }

  public finish(
    attemptId: string,
    submissionInput: FinishDailyAttemptRequest,
    idempotencyKey: string,
  ): Promise<DailyAttemptSubmissionResponse> {
    const submission = finishDailyAttemptRequestSchema.parse(submissionInput);
    return this.request(
      {
        method: "POST",
        path: `/v1/challenges/daily/attempts/${encodeURIComponent(attemptId)}/finish`,
        headers: idempotency(idempotencyKey),
        body: submission,
      },
      dailyAttemptSubmissionResponseSchema,
    );
  }

  public abandon(
    attemptId: string,
    idempotencyKey: string,
  ): Promise<{ readonly attemptId: string; readonly status: "abandoned" }> {
    return this.request(
      {
        method: "POST",
        path: `/v1/challenges/daily/attempts/${encodeURIComponent(attemptId)}/abandon`,
        headers: idempotency(idempotencyKey),
      },
      abandonDailyAttemptResponseSchema,
    );
  }

  public leaderboard(cursor?: string, limit = 50): Promise<DailyLeaderboardPage> {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor !== undefined) query.set("cursor", cursor);
    return this.request(
      { method: "GET", path: `/v1/leaderboards/daily?${query.toString()}` },
      dailyLeaderboardPageSchema,
    );
  }

  public leaderboardMe(): Promise<DailyLeaderboardMe> {
    return this.request(
      { method: "GET", path: "/v1/leaderboards/daily/me" },
      dailyLeaderboardMeSchema,
    );
  }

  private start(
    kind: "practice" | "attempts",
    idempotencyKey: string,
  ): Promise<DailyAttemptStartResponse> {
    return this.request(
      {
        method: "POST",
        path: `/v1/challenges/daily/${kind}/start`,
        headers: idempotency(idempotencyKey),
      },
      dailyAttemptStartResponseSchema,
    );
  }

  private async request<T>(input: JsonRequest, schema: ZodType<T>): Promise<T> {
    const response = await this.sessions.authorizedRequest(input);
    if (response.status < 200 || response.status >= 300)
      throw new Error(`daily challenge request failed with status ${response.status}`);
    return schema.parse(response.body);
  }
}

function idempotency(key: string): Readonly<Record<string, string>> {
  return { "idempotency-key": key };
}
