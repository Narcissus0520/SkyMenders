import { PrismaPg } from "@prisma/adapter-pg";
import { v7 as uuidv7 } from "uuid";

import {
  accountProgressSaveSchema,
  dailyAttemptCheckpointRequestSchema,
  dailyAttemptModeSchema,
  dailyAttemptStatusSchema,
  dailyChallengeDefinitionSchema,
  expeditionSaveDocumentSchema,
  finishDailyAttemptRequestSchema,
  privacyRequestResponseSchema,
  profileSettingsSchema,
  replayVerificationResultSchema,
} from "@skymenders/protocol";
import type {
  AccountProgressSave,
  DailyAttemptCheckpointRequest,
  ExpeditionSaveDocument,
  FinishDailyAttemptRequest,
  ProfileSettings,
  ReplayVerificationResult,
} from "@skymenders/protocol";

import {
  createInitialProgress,
  createSystemCode,
  DEFAULT_PROFILE_SETTINGS,
} from "../core/defaults.js";
import type {
  AccountExport,
  AccountRecord,
  DailyAttemptRecord,
  DailyChallengeRecord,
  GameRepository,
  PrivacyRecord,
  ProfileRecord,
  SaveArchiveInput,
  SessionRecord,
  StoredLeaderboardEntry,
  StoredHttpResult,
  ReplaySubmissionRecord,
  ReplayVerificationContext,
} from "../core/contracts.js";
import { Prisma, PrismaClient } from "../generated/prisma/client.js";

export class PrismaGameRepository implements GameRepository {
  readonly #client: PrismaClient;

  public constructor(connectionString: string) {
    if (
      !connectionString.startsWith("postgresql://") &&
      !connectionString.startsWith("postgres://")
    )
      throw new Error("DATABASE_URL must use PostgreSQL");
    this.#client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  public async findOrCreateAccount(
    platform: "wechat",
    subjectHash: string,
    now: Date,
  ): Promise<AccountRecord> {
    const existing = await this.#client.platformSubject.findUnique({ where: { subjectHash } });
    if (existing !== null) {
      const account = await this.#client.account.findUniqueOrThrow({
        where: { id: existing.accountId },
      });
      return { id: account.id, createdAt: account.createdAt };
    }
    const accountId = uuidv7({ msecs: now.getTime() });
    const progress = createInitialProgress(now);
    try {
      const account = await this.#client.account.create({
        data: {
          id: accountId,
          createdAt: now,
          platformSubject: {
            create: { id: uuidv7(), platform, subjectHash, createdAt: now },
          },
          profile: {
            create: {
              systemCode: createSystemCode(accountId),
              settings: json(DEFAULT_PROFILE_SETTINGS),
              createdAt: now,
            },
          },
          progress: {
            create: {
              logicalClock: progress.logicalClock,
              document: json(progress),
              updatedAt: now,
            },
          },
        },
      });
      return { id: account.id, createdAt: account.createdAt };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002")
        throw error;
      const raced = await this.#client.platformSubject.findUnique({ where: { subjectHash } });
      if (raced === null) throw error;
      const account = await this.#client.account.findUniqueOrThrow({
        where: { id: raced.accountId },
      });
      return { id: account.id, createdAt: account.createdAt };
    }
  }

  public async findAccount(accountId: string): Promise<AccountRecord | null> {
    const account = await this.#client.account.findUnique({ where: { id: accountId } });
    return account === null ? null : { id: account.id, createdAt: account.createdAt };
  }

  public async createSession(session: SessionRecord): Promise<void> {
    await this.#client.session.create({ data: session });
  }

  public async findSessionByRefreshHash(hash: string): Promise<SessionRecord | null> {
    const session = await this.#client.session.findUnique({ where: { refreshTokenHash: hash } });
    return session === null ? null : mapSession(session);
  }

  public async findSession(sessionId: string): Promise<SessionRecord | null> {
    const session = await this.#client.session.findUnique({ where: { id: sessionId } });
    return session === null ? null : mapSession(session);
  }

  public async rotateSession(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.#client.session.update({
      where: { id: sessionId },
      data: { refreshTokenHash, expiresAt },
    });
  }

  public async revokeSessionByRefreshHash(hash: string, now: Date): Promise<void> {
    await this.#client.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  public async revokeAllSessions(accountId: string, now: Date): Promise<void> {
    await this.#client.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  public async getProfile(accountId: string): Promise<ProfileRecord | null> {
    const profile = await this.#client.profile.findUnique({ where: { accountId } });
    return profile === null
      ? null
      : {
          accountId: profile.accountId,
          systemCode: profile.systemCode,
          settings: profileSettingsSchema.parse(profile.settings),
        };
  }

  public async updateProfileSettings(
    accountId: string,
    settings: ProfileSettings,
  ): Promise<ProfileRecord> {
    const profile = await this.#client.profile.update({
      where: { accountId },
      data: { settings: json(settings) },
    });
    return { accountId, systemCode: profile.systemCode, settings };
  }

  public async getProgress(accountId: string): Promise<AccountProgressSave | null> {
    const progress = await this.#client.accountProgress.findUnique({ where: { accountId } });
    return progress === null ? null : accountProgressSaveSchema.parse(progress.document);
  }

  public async putProgress(accountId: string, progress: AccountProgressSave): Promise<void> {
    await this.#client.accountProgress.upsert({
      where: { accountId },
      create: {
        accountId,
        logicalClock: progress.logicalClock,
        document: json(progress),
        updatedAt: new Date(progress.updatedAt),
      },
      update: {
        logicalClock: progress.logicalClock,
        document: json(progress),
        updatedAt: new Date(progress.updatedAt),
      },
    });
  }

  public async getExpeditionSave(accountId: string): Promise<ExpeditionSaveDocument | null> {
    const save = await this.#client.expeditionSave.findUnique({ where: { accountId } });
    return save === null ? null : expeditionSaveDocumentSchema.parse(save.document);
  }

  public async commitExpeditionSave(
    accountId: string,
    expectedRevision: number | null,
    document: ExpeditionSaveDocument,
    archive: SaveArchiveInput | null,
  ): Promise<boolean> {
    try {
      return await this.#client.$transaction(async (transaction) => {
        const data = {
          revision: document.revision,
          logicalClock: document.logicalClock,
          document: json(document),
          updatedAt: new Date(document.updatedAt),
        };
        if (expectedRevision === null) {
          await transaction.expeditionSave.create({ data: { accountId, ...data } });
        } else {
          const update = await transaction.expeditionSave.updateMany({
            where: { accountId, revision: expectedRevision },
            data,
          });
          if (update.count !== 1) return false;
        }
        if (archive !== null)
          await transaction.saveRecovery.create({
            data: {
              id: uuidv7(),
              accountId,
              kind: archive.kind,
              document: json(archive.document),
              expiresAt: archive.expiresAt,
            },
          });
        return true;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return false;
      throw error;
    }
  }

  public async deleteExpeditionSave(accountId: string): Promise<void> {
    await this.#client.expeditionSave.deleteMany({ where: { accountId } });
  }

  public async archiveSave(
    accountId: string,
    kind: "superseded" | "conflict" | "deleted",
    document: ExpeditionSaveDocument,
    expiresAt: Date,
  ): Promise<void> {
    await this.#client.saveRecovery.create({
      data: { id: uuidv7(), accountId, kind, document: json(document), expiresAt },
    });
  }

  public async createPrivacyRequest(record: PrivacyRecord): Promise<void> {
    await this.#client.privacyRequest.create({
      data: {
        id: record.requestId,
        accountId: record.accountId,
        kind: record.kind,
        status: record.status,
        createdAt: new Date(record.createdAt),
        completedAt: record.completedAt === null ? null : new Date(record.completedAt),
      },
    });
  }

  public async updatePrivacyRequest(
    requestId: string,
    status: PrivacyRecord["status"],
    completedAt: Date | null,
  ): Promise<PrivacyRecord> {
    const record = await this.#client.privacyRequest.update({
      where: { id: requestId },
      data: { status, completedAt },
    });
    return mapPrivacy(record);
  }

  public async getPrivacyRequest(
    accountId: string,
    requestId: string,
  ): Promise<PrivacyRecord | null> {
    const record = await this.#client.privacyRequest.findFirst({
      where: { id: requestId, accountId },
    });
    return record === null ? null : mapPrivacy(record);
  }

  public async exportAccount(accountId: string): Promise<AccountExport | null> {
    const account = await this.#client.account.findUnique({
      where: { id: accountId },
      include: { profile: true, progress: true, expeditionSave: true, sessions: true },
    });
    if (account?.profile === null || account?.progress === null || account === null) return null;
    return {
      account: { id: account.id, createdAt: account.createdAt },
      profile: {
        accountId,
        systemCode: account.profile.systemCode,
        settings: profileSettingsSchema.parse(account.profile.settings),
      },
      progress: accountProgressSaveSchema.parse(account.progress.document),
      expeditionSave:
        account.expeditionSave === null
          ? null
          : expeditionSaveDocumentSchema.parse(account.expeditionSave.document),
      sessions: account.sessions.map((session) => {
        const { refreshTokenHash, ...publicSession } = mapSession(session);
        void refreshTokenHash;
        return publicSession;
      }),
    };
  }

  public async hardDeleteAccount(accountId: string): Promise<void> {
    await this.#client.account.deleteMany({ where: { id: accountId } });
  }

  public async getIdempotency(
    accountId: string,
    route: string,
    key: string,
    now: Date,
  ): Promise<StoredHttpResult | null> {
    const record = await this.#client.idempotencyRecord.findUnique({
      where: { accountId_route_key: { accountId, route, key } },
    });
    if (record === null || record.expiresAt <= now) return null;
    return { statusCode: record.statusCode, response: record.response };
  }

  public async putIdempotency(
    accountId: string,
    route: string,
    key: string,
    result: StoredHttpResult,
    expiresAt: Date,
  ): Promise<void> {
    await this.#client.idempotencyRecord.upsert({
      where: { accountId_route_key: { accountId, route, key } },
      create: {
        id: uuidv7(),
        accountId,
        route,
        key,
        statusCode: result.statusCode,
        response: json(result.response),
        expiresAt,
      },
      update: {},
    });
  }

  public async ensureDailyChallenge(record: DailyChallengeRecord): Promise<DailyChallengeRecord> {
    const challenge = await this.#client.dailyChallenge.upsert({
      where: {
        businessDate_rulesVersion_contentVersion: {
          businessDate: new Date(`${record.definition.businessDate}T00:00:00.000Z`),
          rulesVersion: record.definition.rulesVersion,
          contentVersion: record.definition.contentVersion,
        },
      },
      create: {
        id: record.id,
        businessDate: new Date(`${record.definition.businessDate}T00:00:00.000Z`),
        rulesVersion: record.definition.rulesVersion,
        contentVersion: record.definition.contentVersion,
        seed: BigInt(record.definition.seed),
        definition: json(record.definition),
        createdAt: record.createdAt,
        updatedAt: record.createdAt,
      },
      update: {},
    });
    return mapChallenge(challenge);
  }

  public async getDailyChallenge(challengeId: string): Promise<DailyChallengeRecord | null> {
    const challenge = await this.#client.dailyChallenge.findUnique({ where: { id: challengeId } });
    return challenge === null ? null : mapChallenge(challenge);
  }

  public async countFormalAttempts(accountId: string, challengeId: string): Promise<number> {
    return this.#client.dailyAttempt.count({
      where: { accountId, challengeId, mode: "formal" },
    });
  }

  public async findActiveDailyAttempt(
    accountId: string,
    challengeId: string,
  ): Promise<DailyAttemptRecord | null> {
    const attempt = await this.#client.dailyAttempt.findFirst({
      where: { accountId, challengeId, status: "active" },
      orderBy: { startedAt: "desc" },
    });
    return attempt === null ? null : mapAttempt(attempt);
  }

  public async createPracticeAttempt(record: DailyAttemptRecord): Promise<DailyAttemptRecord> {
    return mapAttempt(await this.#client.dailyAttempt.create({ data: dailyAttemptData(record) }));
  }

  public async createFormalAttempt(record: DailyAttemptRecord): Promise<DailyAttemptRecord | null> {
    try {
      return mapAttempt(await this.#client.dailyAttempt.create({ data: dailyAttemptData(record) }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return null;
      throw error;
    }
  }

  public async getDailyAttempt(
    accountId: string,
    attemptId: string,
  ): Promise<DailyAttemptRecord | null> {
    const attempt = await this.#client.dailyAttempt.findFirst({
      where: { id: attemptId, accountId },
    });
    return attempt === null ? null : mapAttempt(attempt);
  }

  public async saveDailyCheckpoint(
    accountId: string,
    attemptId: string,
    checkpoint: DailyAttemptCheckpointRequest,
    now: Date,
  ): Promise<boolean> {
    const updated = await this.#client.dailyAttempt.updateMany({
      where: {
        id: attemptId,
        accountId,
        status: "active",
        OR: [{ checkpointIndex: null }, { checkpointIndex: { lt: checkpoint.checkpointIndex } }],
      },
      data: {
        checkpointIndex: checkpoint.checkpointIndex,
        checkpoint: json(checkpoint),
        updatedAt: now,
      },
    });
    return updated.count === 1;
  }

  public async abandonDailyAttempt(
    accountId: string,
    attemptId: string,
    now: Date,
  ): Promise<boolean> {
    const updated = await this.#client.dailyAttempt.updateMany({
      where: { id: attemptId, accountId, status: "active" },
      data: { status: "abandoned", updatedAt: now, completedAt: now },
    });
    return updated.count === 1;
  }

  public async submitDailyAttempt(
    accountId: string,
    attemptId: string,
    request: FinishDailyAttemptRequest,
    now: Date,
  ): Promise<ReplaySubmissionRecord | null> {
    try {
      return await this.#client.$transaction(async (transaction) => {
        const attempt = await transaction.dailyAttempt.findFirst({
          where: { id: attemptId, accountId },
          include: { submission: true },
        });
        if (attempt?.submission !== null && attempt?.submission !== undefined)
          return attempt.submission.id === request.submissionId
            ? mapSubmission(attempt.submission)
            : null;
        if (attempt?.status !== "active") return null;
        const claimed = await transaction.dailyAttempt.updateMany({
          where: { id: attemptId, accountId, status: "active" },
          data: { status: "submitted", updatedAt: now },
        });
        if (claimed.count !== 1) return null;
        const submission = await transaction.replaySubmission.create({
          data: {
            id: request.submissionId,
            attemptId,
            request: json(request),
            status: "queued",
            createdAt: now,
            updatedAt: now,
          },
        });
        return mapSubmission(submission);
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002")
        throw error;
      const existing = await this.#client.replaySubmission.findUnique({
        where: { id: request.submissionId },
      });
      return existing === null ? null : mapSubmission(existing);
    }
  }

  public async getReplaySubmission(submissionId: string): Promise<ReplaySubmissionRecord | null> {
    const submission = await this.#client.replaySubmission.findUnique({
      where: { id: submissionId },
    });
    return submission === null ? null : mapSubmission(submission);
  }

  public async getReplayVerificationContext(
    submissionId: string,
  ): Promise<ReplayVerificationContext | null> {
    const record = await this.#client.replaySubmission.findUnique({
      where: { id: submissionId },
      include: { attempt: { include: { challenge: true } } },
    });
    return record === null
      ? null
      : {
          submission: mapSubmission(record),
          challenge: mapChallenge(record.attempt.challenge),
        };
  }

  public async completeReplaySubmission(
    submissionId: string,
    resultInput: ReplayVerificationResult,
    now: Date,
  ): Promise<{ readonly challengeId: string; readonly leaderboardChanged: boolean } | null> {
    const result = replayVerificationResultSchema.parse(resultInput);
    return this.#client.$transaction(async (transaction) => {
      const submission = await transaction.replaySubmission.findUnique({
        where: { id: submissionId },
        include: {
          attempt: {
            include: { challenge: true, account: { include: { profile: true } } },
          },
        },
      });
      if (submission === null) return null;
      const { attempt } = submission;
      if (submission.status === "verified" || submission.status === "rejected")
        return { challengeId: attempt.challengeId, leaderboardChanged: false };
      await transaction.replaySubmission.update({
        where: { id: submissionId },
        data: {
          status: result.status,
          score: result.score,
          totalTurns: result.totalTurns,
          rejectionCode: result.rejectionCode,
          updatedAt: now,
          verifiedAt: now,
        },
      });
      await transaction.dailyAttempt.update({
        where: { id: attempt.id },
        data: { status: result.status, updatedAt: now, completedAt: now },
      });
      if (result.status === "rejected") {
        await transaction.replayRiskEvent.upsert({
          where: { submissionId },
          create: {
            id: uuidv7(),
            accountId: attempt.accountId,
            submissionId,
            code: result.rejectionCode ?? "REPLAY_INVALID",
            createdAt: now,
          },
          update: {},
        });
        return { challengeId: attempt.challengeId, leaderboardChanged: false };
      }
      if (
        attempt.mode !== "formal" ||
        result.score === null ||
        result.totalTurns === null ||
        attempt.account.profile === null
      )
        return { challengeId: attempt.challengeId, leaderboardChanged: false };
      const request = finishDailyAttemptRequestSchema.parse(submission.request);
      const challenge = dailyChallengeDefinitionSchema.parse(attempt.challenge.definition);
      const existing = await transaction.leaderboardEntry.findUnique({
        where: {
          challengeId_accountId: {
            challengeId: attempt.challengeId,
            accountId: attempt.accountId,
          },
        },
      });
      const candidate = {
        score: result.score,
        completionMs: request.completionMs,
        turns: result.totalTurns,
      };
      if (existing !== null && !isBetterLeaderboard(candidate, existing))
        return { challengeId: attempt.challengeId, leaderboardChanged: false };
      await transaction.leaderboardEntry.upsert({
        where: {
          challengeId_accountId: {
            challengeId: attempt.challengeId,
            accountId: attempt.accountId,
          },
        },
        create: {
          id: uuidv7(),
          challengeId: attempt.challengeId,
          accountId: attempt.accountId,
          submissionId,
          systemCode: attempt.account.profile.systemCode,
          avatarId: `avatar_${challenge.loadouts[0].robotId}`,
          score: result.score,
          completionMs: request.completionMs,
          turns: result.totalTurns,
          completionStatus: request.completionStatus,
          verificationStatus: "verified",
          createdAt: now,
          updatedAt: now,
        },
        update: {
          submissionId,
          score: result.score,
          completionMs: request.completionMs,
          turns: result.totalTurns,
          completionStatus: request.completionStatus,
          verificationStatus: "verified",
          updatedAt: now,
        },
      });
      return { challengeId: attempt.challengeId, leaderboardChanged: true };
    });
  }

  public async listLeaderboard(
    challengeId: string,
    offset: number,
    limit: number,
  ): Promise<readonly StoredLeaderboardEntry[]> {
    const entries = await this.#client.leaderboardEntry.findMany({
      where: { challengeId, verificationStatus: "verified" },
      orderBy: [
        { score: "desc" },
        { completionMs: "asc" },
        { turns: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      skip: offset,
      take: limit,
    });
    return entries.map(mapLeaderboard);
  }

  public async getLeaderboardEntry(
    challengeId: string,
    accountId: string,
  ): Promise<{ readonly entry: StoredLeaderboardEntry; readonly rank: number } | null> {
    const entry = await this.#client.leaderboardEntry.findUnique({
      where: { challengeId_accountId: { challengeId, accountId } },
    });
    if (entry?.verificationStatus !== "verified") return null;
    const better = await this.#client.leaderboardEntry.count({
      where: {
        challengeId,
        verificationStatus: "verified",
        OR: [
          { score: { gt: entry.score } },
          { score: entry.score, completionMs: { lt: entry.completionMs } },
          { score: entry.score, completionMs: entry.completionMs, turns: { lt: entry.turns } },
          {
            score: entry.score,
            completionMs: entry.completionMs,
            turns: entry.turns,
            createdAt: { lt: entry.createdAt },
          },
          {
            score: entry.score,
            completionMs: entry.completionMs,
            turns: entry.turns,
            createdAt: entry.createdAt,
            id: { lt: entry.id },
          },
        ],
      },
    });
    return { entry: mapLeaderboard(entry), rank: better + 1 };
  }

  public async close(): Promise<void> {
    await this.#client.$disconnect();
  }

  public async health(): Promise<void> {
    await this.#client.$queryRaw`SELECT 1`;
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapSession(session: {
  id: string;
  accountId: string;
  refreshTokenHash: string;
  deviceKind: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}): SessionRecord {
  if (
    session.deviceKind !== "wechat" &&
    session.deviceKind !== "web" &&
    session.deviceKind !== "unknown"
  )
    throw new Error("database contains an invalid device kind");
  return { ...session, deviceKind: session.deviceKind };
}

function mapPrivacy(record: {
  id: string;
  accountId: string | null;
  kind: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}): PrivacyRecord {
  const publicRecord = privacyRequestResponseSchema.parse({
    requestId: record.id,
    kind: record.kind,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  });
  return { ...publicRecord, accountId: record.accountId };
}

function mapChallenge(record: {
  id: string;
  definition: Prisma.JsonValue;
  createdAt: Date;
}): DailyChallengeRecord {
  return {
    id: record.id,
    definition: dailyChallengeDefinitionSchema.parse(record.definition),
    createdAt: record.createdAt,
  };
}

function dailyAttemptData(record: DailyAttemptRecord) {
  return {
    id: record.id,
    accountId: record.accountId,
    challengeId: record.challengeId,
    mode: record.mode,
    formalSlot: record.formalSlot,
    status: record.status,
    checkpointIndex: record.checkpointIndex,
    checkpoint: record.checkpoint === null ? Prisma.JsonNull : json(record.checkpoint),
    startedAt: record.startedAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  };
}

function mapAttempt(record: {
  id: string;
  accountId: string;
  challengeId: string;
  mode: string;
  formalSlot: number | null;
  status: string;
  checkpointIndex: number | null;
  checkpoint: Prisma.JsonValue | null;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): DailyAttemptRecord {
  return {
    ...record,
    mode: dailyAttemptModeSchema.parse(record.mode),
    status: dailyAttemptStatusSchema.parse(record.status),
    checkpoint:
      record.checkpoint === null
        ? null
        : dailyAttemptCheckpointRequestSchema.parse(record.checkpoint),
  };
}

function mapSubmission(record: {
  id: string;
  attemptId: string;
  request: Prisma.JsonValue;
  status: string;
  score: number | null;
  totalTurns: number | null;
  rejectionCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt: Date | null;
}): ReplaySubmissionRecord {
  if (!["queued", "verifying", "verified", "rejected"].includes(record.status))
    throw new Error("database contains an invalid replay submission status");
  const result = replayVerificationResultSchema.shape.rejectionCode.parse(record.rejectionCode);
  return {
    ...record,
    request: finishDailyAttemptRequestSchema.parse(record.request),
    status: record.status as ReplaySubmissionRecord["status"],
    rejectionCode: result,
  };
}

function mapLeaderboard(record: {
  id: string;
  challengeId: string;
  accountId: string;
  submissionId: string;
  systemCode: string;
  avatarId: string;
  score: number;
  completionMs: number;
  turns: number;
  completionStatus: string;
  createdAt: Date;
  updatedAt: Date;
}): StoredLeaderboardEntry {
  if (record.completionStatus !== "completed" && record.completionStatus !== "failed")
    throw new Error("database contains an invalid completion status");
  return { ...record, completionStatus: record.completionStatus };
}

function isBetterLeaderboard(
  candidate: { readonly score: number; readonly completionMs: number; readonly turns: number },
  existing: { readonly score: number; readonly completionMs: number; readonly turns: number },
): boolean {
  return (
    candidate.score > existing.score ||
    (candidate.score === existing.score && candidate.completionMs < existing.completionMs) ||
    (candidate.score === existing.score &&
      candidate.completionMs === existing.completionMs &&
      candidate.turns < existing.turns)
  );
}
