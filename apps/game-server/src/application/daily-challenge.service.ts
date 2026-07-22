import { Inject, Injectable } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";

import { createDailyChallenge } from "@skymenders/challenge-core";
import type { PveContentPack } from "@skymenders/content-schema";
import {
  dailyAttemptCheckpointRequestSchema,
  finishDailyAttemptRequestSchema,
} from "@skymenders/protocol";
import type {
  DailyAttemptCheckpointResponse,
  DailyAttemptStartResponse,
  DailyAttemptSubmissionResponse,
  DailyChallengeDefinition,
  DailyChallengeResponse,
} from "@skymenders/protocol";
import { CURRENT_PRODUCT_VERSIONS } from "@skymenders/shared-types";

import {
  CHALLENGE_CONTENT,
  GAME_REPOSITORY,
  REPLAY_VERIFICATION_QUEUE,
  SERVER_CLOCK,
  SERVER_CONFIG,
} from "../core/contracts.js";
import type {
  DailyAttemptRecord,
  GameRepository,
  ReplayVerificationQueue,
  ServerClock,
} from "../core/contracts.js";
import type { ServerConfig } from "../core/server-config.js";
import { ApiError } from "../http/api-error.js";

@Injectable()
export class DailyChallengeService {
  public constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
    @Inject(SERVER_CONFIG) private readonly config: ServerConfig,
    @Inject(CHALLENGE_CONTENT) private readonly content: PveContentPack | null,
    @Inject(REPLAY_VERIFICATION_QUEUE) private readonly queue: ReplayVerificationQueue,
  ) {}

  public async getDaily(accountId: string): Promise<DailyChallengeResponse> {
    const challenge = await this.currentChallenge();
    const [attemptsUsed, progress, active] = await Promise.all([
      this.repository.countFormalAttempts(accountId, challenge.challengeId),
      this.repository.getProgress(accountId),
      this.repository.findActiveDailyAttempt(accountId, challenge.challengeId),
    ]);
    return {
      challenge,
      formalAttemptsRemaining: Math.max(0, 3 - attemptsUsed),
      formalUnlocked: (progress?.statistics.standard_regions_completed ?? 0) >= 1,
      activeAttemptId: active?.id ?? null,
      activeAttempt:
        active === null
          ? null
          : {
              attemptId: active.id,
              mode: active.mode,
              checkpoint: active.checkpoint,
            },
    };
  }

  public previewCurrentChallenge(): Promise<DailyChallengeDefinition> {
    return this.currentChallenge();
  }

  public async startPractice(accountId: string): Promise<DailyAttemptStartResponse> {
    const challenge = await this.currentChallenge();
    const attempt = await this.repository.createPracticeAttempt(
      this.attempt(accountId, challenge.challengeId, "practice", null),
    );
    return this.startResponse(attempt, challenge, await this.formalRemaining(accountId, challenge));
  }

  public async startFormal(accountId: string): Promise<DailyAttemptStartResponse> {
    const challenge = await this.currentChallenge();
    const progress = await this.repository.getProgress(accountId);
    if ((progress?.statistics.standard_regions_completed ?? 0) < 1)
      throw new ApiError(
        403,
        "FORMAL_CHALLENGE_LOCKED",
        "Complete the first standard expedition region before formal daily attempts",
      );
    for (let slot = 1; slot <= 3; slot += 1) {
      const attempt = await this.repository.createFormalAttempt(
        this.attempt(accountId, challenge.challengeId, "formal", slot),
      );
      if (attempt !== null)
        return this.startResponse(
          attempt,
          challenge,
          await this.formalRemaining(accountId, challenge),
        );
    }
    throw new ApiError(409, "DAILY_ATTEMPTS_EXHAUSTED", "All formal attempts are consumed");
  }

  public async checkpoint(
    accountId: string,
    attemptId: string,
    input: unknown,
  ): Promise<DailyAttemptCheckpointResponse> {
    const checkpoint = dailyAttemptCheckpointRequestSchema.parse(input);
    const acceptedAt = this.clock.now();
    if (!(await this.repository.saveDailyCheckpoint(accountId, attemptId, checkpoint, acceptedAt)))
      throw new ApiError(
        409,
        "CHECKPOINT_REJECTED",
        "Attempt is not active or checkpoint is not newer",
      );
    return {
      attemptId,
      checkpointIndex: checkpoint.checkpointIndex,
      acceptedAt: acceptedAt.toISOString(),
    };
  }

  public async finish(
    accountId: string,
    attemptId: string,
    input: unknown,
  ): Promise<DailyAttemptSubmissionResponse> {
    const request = finishDailyAttemptRequestSchema.parse(input);
    if (request.clientVersion !== CURRENT_PRODUCT_VERSIONS.clientVersion)
      throw new ApiError(409, "CLIENT_VERSION_UNSUPPORTED", "Client version cannot be verified");
    const now = this.clock.now();
    const submission = await this.repository.submitDailyAttempt(accountId, attemptId, request, now);
    if (submission === null)
      throw new ApiError(409, "ATTEMPT_NOT_ACTIVE", "Attempt cannot accept a replay submission");
    await this.queue.enqueue(submission.id);
    return { attemptId, submissionId: submission.id, status: "queued" };
  }

  public async abandon(
    accountId: string,
    attemptId: string,
  ): Promise<{ readonly attemptId: string; readonly status: "abandoned" }> {
    if (!(await this.repository.abandonDailyAttempt(accountId, attemptId, this.clock.now())))
      throw new ApiError(409, "ATTEMPT_NOT_ACTIVE", "Attempt cannot be abandoned");
    return { attemptId, status: "abandoned" };
  }

  public async currentChallenge(): Promise<DailyChallengeDefinition> {
    if (this.content === null)
      throw new ApiError(503, "CHALLENGE_UNAVAILABLE", "Daily challenge content is unavailable");
    const now = this.clock.now();
    const definition = createDailyChallenge(this.content, {
      instant: now,
      timeZone: this.config.dailyChallengeTimeZone,
      seedSecret: this.config.challengeSeedSecret,
      rulesVersion: CURRENT_PRODUCT_VERSIONS.rulesVersion,
      contentVersion: CURRENT_PRODUCT_VERSIONS.contentVersion,
    });
    return (
      await this.repository.ensureDailyChallenge({
        id: definition.challengeId,
        definition,
        createdAt: now,
      })
    ).definition;
  }

  private attempt(
    accountId: string,
    challengeId: string,
    mode: "practice" | "formal",
    formalSlot: number | null,
  ): DailyAttemptRecord {
    const now = this.clock.now();
    return {
      id: uuidv7({ msecs: now.getTime() }),
      accountId,
      challengeId,
      mode,
      formalSlot,
      status: "active",
      checkpointIndex: null,
      checkpoint: null,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
    };
  }

  private async formalRemaining(
    accountId: string,
    challenge: DailyChallengeDefinition,
  ): Promise<number> {
    return Math.max(
      0,
      3 - (await this.repository.countFormalAttempts(accountId, challenge.challengeId)),
    );
  }

  private startResponse(
    attempt: DailyAttemptRecord,
    challenge: DailyChallengeDefinition,
    formalAttemptsRemaining: number,
  ): DailyAttemptStartResponse {
    return {
      attemptId: attempt.id,
      challenge,
      mode: attempt.mode,
      status: "active",
      formalAttemptsRemaining,
      checkpoint: attempt.checkpoint,
    };
  }
}
