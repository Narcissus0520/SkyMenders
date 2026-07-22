/* eslint-disable @typescript-eslint/require-await -- synchronous test adapter implements async repository contract */
import { v7 as uuidv7 } from "uuid";

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

interface RecoveryRecord {
  readonly accountId: string;
  readonly kind: "superseded" | "conflict" | "deleted";
  readonly document: ExpeditionSaveDocument;
  readonly expiresAt: Date;
}

export class MemoryGameRepository implements GameRepository {
  readonly #accounts = new Map<string, AccountRecord>();
  readonly #subjects = new Map<string, string>();
  readonly #sessions = new Map<string, SessionRecord>();
  readonly #profiles = new Map<string, ProfileRecord>();
  readonly #progress = new Map<string, AccountProgressSave>();
  readonly #saves = new Map<string, ExpeditionSaveDocument>();
  readonly #recovery: RecoveryRecord[] = [];
  readonly #privacy = new Map<string, PrivacyRecord>();
  readonly #idempotency = new Map<string, { result: StoredHttpResult; expiresAt: Date }>();
  readonly #challenges = new Map<string, DailyChallengeRecord>();
  readonly #attempts = new Map<string, DailyAttemptRecord>();
  readonly #submissions = new Map<string, ReplaySubmissionRecord>();
  readonly #leaderboard = new Map<string, StoredLeaderboardEntry>();
  readonly #riskEvents: { readonly accountId: string; readonly code: string }[] = [];

  public async findOrCreateAccount(
    platform: "wechat",
    subjectHash: string,
    now: Date,
  ): Promise<AccountRecord> {
    const subjectKey = `${platform}:${subjectHash}`;
    const existingId = this.#subjects.get(subjectKey);
    if (existingId !== undefined) {
      const existing = this.#accounts.get(existingId);
      if (existing === undefined) throw new Error("platform subject references a missing account");
      return clone(existing);
    }
    const account: AccountRecord = { id: uuidv7({ msecs: now.getTime() }), createdAt: now };
    this.#accounts.set(account.id, account);
    this.#subjects.set(subjectKey, account.id);
    this.#profiles.set(account.id, {
      accountId: account.id,
      systemCode: createSystemCode(account.id),
      settings: DEFAULT_PROFILE_SETTINGS,
    });
    this.#progress.set(account.id, createInitialProgress(now));
    return clone(account);
  }

  public async findAccount(accountId: string): Promise<AccountRecord | null> {
    return cloneNullable(this.#accounts.get(accountId));
  }

  public async createSession(session: SessionRecord): Promise<void> {
    this.assertAccount(session.accountId);
    this.#sessions.set(session.id, clone(session));
  }

  public async findSessionByRefreshHash(hash: string): Promise<SessionRecord | null> {
    return cloneNullable(
      [...this.#sessions.values()].find((session) => session.refreshTokenHash === hash),
    );
  }

  public async findSession(sessionId: string): Promise<SessionRecord | null> {
    return cloneNullable(this.#sessions.get(sessionId));
  }

  public async rotateSession(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const session = this.#sessions.get(sessionId);
    if (session === undefined) throw new Error("session not found");
    this.#sessions.set(sessionId, { ...session, refreshTokenHash, expiresAt });
  }

  public async revokeSessionByRefreshHash(hash: string, now: Date): Promise<void> {
    const session = [...this.#sessions.values()].find(
      (candidate) => candidate.refreshTokenHash === hash,
    );
    if (session !== undefined) this.#sessions.set(session.id, { ...session, revokedAt: now });
  }

  public async revokeAllSessions(accountId: string, now: Date): Promise<void> {
    for (const [id, session] of this.#sessions) {
      if (session.accountId === accountId) this.#sessions.set(id, { ...session, revokedAt: now });
    }
  }

  public async getProfile(accountId: string): Promise<ProfileRecord | null> {
    return cloneNullable(this.#profiles.get(accountId));
  }

  public async updateProfileSettings(
    accountId: string,
    settings: ProfileSettings,
  ): Promise<ProfileRecord> {
    const profile = this.#profiles.get(accountId);
    if (profile === undefined) throw new Error("profile not found");
    const updated = { ...profile, settings: clone(settings) };
    this.#profiles.set(accountId, updated);
    return clone(updated);
  }

  public async getProgress(accountId: string): Promise<AccountProgressSave | null> {
    return cloneNullable(this.#progress.get(accountId));
  }

  public async putProgress(accountId: string, progress: AccountProgressSave): Promise<void> {
    this.assertAccount(accountId);
    this.#progress.set(accountId, clone(progress));
  }

  public async getExpeditionSave(accountId: string): Promise<ExpeditionSaveDocument | null> {
    return cloneNullable(this.#saves.get(accountId));
  }

  public async commitExpeditionSave(
    accountId: string,
    expectedRevision: number | null,
    document: ExpeditionSaveDocument,
    archive: SaveArchiveInput | null,
  ): Promise<boolean> {
    this.assertAccount(accountId);
    const current = this.#saves.get(accountId);
    if ((current?.revision ?? null) !== expectedRevision) return false;
    if (archive !== null)
      this.#recovery.push({
        accountId,
        kind: archive.kind,
        document: clone(archive.document),
        expiresAt: archive.expiresAt,
      });
    this.#saves.set(accountId, clone(document));
    return true;
  }

  public async deleteExpeditionSave(accountId: string): Promise<void> {
    this.#saves.delete(accountId);
  }

  public async archiveSave(
    accountId: string,
    kind: RecoveryRecord["kind"],
    document: ExpeditionSaveDocument,
    expiresAt: Date,
  ): Promise<void> {
    this.#recovery.push({ accountId, kind, document: clone(document), expiresAt });
  }

  public async createPrivacyRequest(record: PrivacyRecord): Promise<void> {
    this.#privacy.set(record.requestId, clone(record));
  }

  public async updatePrivacyRequest(
    requestId: string,
    status: PrivacyRecord["status"],
    completedAt: Date | null,
  ): Promise<PrivacyRecord> {
    const record = this.#privacy.get(requestId);
    if (record === undefined) throw new Error("privacy request not found");
    const updated = { ...record, status, completedAt: completedAt?.toISOString() ?? null };
    this.#privacy.set(requestId, updated);
    return clone(updated);
  }

  public async getPrivacyRequest(
    accountId: string,
    requestId: string,
  ): Promise<PrivacyRecord | null> {
    const record = this.#privacy.get(requestId);
    return record?.accountId === accountId ? clone(record) : null;
  }

  public async exportAccount(accountId: string): Promise<AccountExport | null> {
    const account = this.#accounts.get(accountId);
    const profile = this.#profiles.get(accountId);
    const progress = this.#progress.get(accountId);
    if (account === undefined || profile === undefined || progress === undefined) return null;
    return clone({
      account,
      profile,
      progress,
      expeditionSave: this.#saves.get(accountId) ?? null,
      sessions: [...this.#sessions.values()]
        .filter((session) => session.accountId === accountId)
        .map(({ refreshTokenHash: _refreshTokenHash, ...session }) => session),
    });
  }

  public async hardDeleteAccount(accountId: string): Promise<void> {
    this.#accounts.delete(accountId);
    this.#profiles.delete(accountId);
    this.#progress.delete(accountId);
    this.#saves.delete(accountId);
    for (const [key, id] of this.#subjects) if (id === accountId) this.#subjects.delete(key);
    for (const [id, session] of this.#sessions)
      if (session.accountId === accountId) this.#sessions.delete(id);
    for (const [id, record] of this.#privacy)
      if (record.accountId === accountId) this.#privacy.set(id, { ...record, accountId: null });
    for (const key of this.#idempotency.keys())
      if (key.startsWith(`${accountId}:`)) this.#idempotency.delete(key);
    for (let index = this.#recovery.length - 1; index >= 0; index -= 1)
      if (this.#recovery[index]?.accountId === accountId) this.#recovery.splice(index, 1);
    const attemptIds = [...this.#attempts.values()]
      .filter((attempt) => attempt.accountId === accountId)
      .map((attempt) => attempt.id);
    for (const attemptId of attemptIds) this.#attempts.delete(attemptId);
    for (const [id, submission] of this.#submissions)
      if (attemptIds.includes(submission.attemptId)) this.#submissions.delete(id);
    for (const [key, entry] of this.#leaderboard)
      if (entry.accountId === accountId) this.#leaderboard.delete(key);
    for (let index = this.#riskEvents.length - 1; index >= 0; index -= 1)
      if (this.#riskEvents[index]?.accountId === accountId) this.#riskEvents.splice(index, 1);
  }

  public async getIdempotency(
    accountId: string,
    route: string,
    key: string,
    now: Date,
  ): Promise<StoredHttpResult | null> {
    const entry = this.#idempotency.get(`${accountId}:${route}:${key}`);
    if (entry === undefined || entry.expiresAt <= now) return null;
    return clone(entry.result);
  }

  public async putIdempotency(
    accountId: string,
    route: string,
    key: string,
    result: StoredHttpResult,
    expiresAt: Date,
  ): Promise<void> {
    this.#idempotency.set(`${accountId}:${route}:${key}`, { result: clone(result), expiresAt });
  }

  public async ensureDailyChallenge(record: DailyChallengeRecord): Promise<DailyChallengeRecord> {
    const existing = [...this.#challenges.values()].find(
      (challenge) =>
        challenge.definition.businessDate === record.definition.businessDate &&
        challenge.definition.rulesVersion === record.definition.rulesVersion &&
        challenge.definition.contentVersion === record.definition.contentVersion,
    );
    if (existing !== undefined) return clone(existing);
    this.#challenges.set(record.id, clone(record));
    return clone(record);
  }

  public async getDailyChallenge(challengeId: string): Promise<DailyChallengeRecord | null> {
    return cloneNullable(this.#challenges.get(challengeId));
  }

  public async countFormalAttempts(accountId: string, challengeId: string): Promise<number> {
    return [...this.#attempts.values()].filter(
      (attempt) =>
        attempt.accountId === accountId &&
        attempt.challengeId === challengeId &&
        attempt.mode === "formal",
    ).length;
  }

  public async findActiveDailyAttempt(
    accountId: string,
    challengeId: string,
  ): Promise<DailyAttemptRecord | null> {
    const active = [...this.#attempts.values()]
      .filter(
        (attempt) =>
          attempt.accountId === accountId &&
          attempt.challengeId === challengeId &&
          attempt.status === "active",
      )
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0];
    return cloneNullable(active);
  }

  public async createPracticeAttempt(record: DailyAttemptRecord): Promise<DailyAttemptRecord> {
    this.assertAccount(record.accountId);
    if (!this.#challenges.has(record.challengeId)) throw new Error("daily challenge not found");
    this.#attempts.set(record.id, clone(record));
    return clone(record);
  }

  public async createFormalAttempt(record: DailyAttemptRecord): Promise<DailyAttemptRecord | null> {
    this.assertAccount(record.accountId);
    if (record.formalSlot === null) throw new Error("formal attempt requires a slot");
    if (
      [...this.#attempts.values()].some(
        (attempt) =>
          attempt.accountId === record.accountId &&
          attempt.challengeId === record.challengeId &&
          attempt.formalSlot === record.formalSlot,
      )
    )
      return null;
    this.#attempts.set(record.id, clone(record));
    return clone(record);
  }

  public async getDailyAttempt(
    accountId: string,
    attemptId: string,
  ): Promise<DailyAttemptRecord | null> {
    const attempt = this.#attempts.get(attemptId);
    return attempt?.accountId === accountId ? clone(attempt) : null;
  }

  public async saveDailyCheckpoint(
    accountId: string,
    attemptId: string,
    checkpoint: DailyAttemptCheckpointRequest,
    now: Date,
  ): Promise<boolean> {
    const attempt = this.#attempts.get(attemptId);
    if (
      attempt?.accountId !== accountId ||
      attempt.status !== "active" ||
      (attempt.checkpointIndex !== null && checkpoint.checkpointIndex <= attempt.checkpointIndex)
    )
      return false;
    this.#attempts.set(attemptId, {
      ...attempt,
      checkpointIndex: checkpoint.checkpointIndex,
      checkpoint: clone(checkpoint),
      updatedAt: now,
    });
    return true;
  }

  public async abandonDailyAttempt(
    accountId: string,
    attemptId: string,
    now: Date,
  ): Promise<boolean> {
    const attempt = this.#attempts.get(attemptId);
    if (attempt?.accountId !== accountId || attempt.status !== "active") return false;
    this.#attempts.set(attemptId, {
      ...attempt,
      status: "abandoned",
      updatedAt: now,
      completedAt: now,
    });
    return true;
  }

  public async submitDailyAttempt(
    accountId: string,
    attemptId: string,
    request: FinishDailyAttemptRequest,
    now: Date,
  ): Promise<ReplaySubmissionRecord | null> {
    const attempt = this.#attempts.get(attemptId);
    const existing = [...this.#submissions.values()].find(
      (submission) => submission.attemptId === attemptId,
    );
    if (existing !== undefined)
      return existing.id === request.submissionId ? clone(existing) : null;
    if (attempt?.accountId !== accountId || attempt.status !== "active") return null;
    const submission: ReplaySubmissionRecord = {
      id: request.submissionId,
      attemptId,
      request: clone(request),
      status: "queued",
      score: null,
      totalTurns: null,
      rejectionCode: null,
      createdAt: now,
      updatedAt: now,
      verifiedAt: null,
    };
    this.#submissions.set(submission.id, submission);
    this.#attempts.set(attemptId, { ...attempt, status: "submitted", updatedAt: now });
    return clone(submission);
  }

  public async getReplaySubmission(submissionId: string): Promise<ReplaySubmissionRecord | null> {
    return cloneNullable(this.#submissions.get(submissionId));
  }

  public async getReplayVerificationContext(
    submissionId: string,
  ): Promise<ReplayVerificationContext | null> {
    const submission = this.#submissions.get(submissionId);
    const attempt = submission === undefined ? undefined : this.#attempts.get(submission.attemptId);
    const challenge = attempt === undefined ? undefined : this.#challenges.get(attempt.challengeId);
    return submission === undefined || challenge === undefined
      ? null
      : clone({ submission, challenge });
  }

  public async completeReplaySubmission(
    submissionId: string,
    result: ReplayVerificationResult,
    now: Date,
  ): Promise<{ readonly challengeId: string; readonly leaderboardChanged: boolean } | null> {
    const submission = this.#submissions.get(submissionId);
    const attempt = submission === undefined ? undefined : this.#attempts.get(submission.attemptId);
    if (submission === undefined || attempt === undefined) return null;
    if (submission.status === "verified" || submission.status === "rejected")
      return { challengeId: attempt.challengeId, leaderboardChanged: false };
    this.#submissions.set(submissionId, {
      ...submission,
      status: result.status,
      score: result.score,
      totalTurns: result.totalTurns,
      rejectionCode: result.rejectionCode,
      updatedAt: now,
      verifiedAt: now,
    });
    this.#attempts.set(attempt.id, {
      ...attempt,
      status: result.status,
      updatedAt: now,
      completedAt: now,
    });
    if (result.status === "rejected") {
      this.#riskEvents.push({
        accountId: attempt.accountId,
        code: result.rejectionCode ?? "REPLAY_INVALID",
      });
      return { challengeId: attempt.challengeId, leaderboardChanged: false };
    }
    if (attempt.mode !== "formal" || result.score === null || result.totalTurns === null)
      return { challengeId: attempt.challengeId, leaderboardChanged: false };
    const profile = this.#profiles.get(attempt.accountId);
    const challenge = this.#challenges.get(attempt.challengeId);
    if (profile === undefined || challenge === undefined)
      throw new Error("verified attempt owner is missing");
    const key = `${attempt.challengeId}:${attempt.accountId}`;
    const existing = this.#leaderboard.get(key);
    const candidate: StoredLeaderboardEntry = {
      id: existing?.id ?? uuidv7(),
      challengeId: attempt.challengeId,
      accountId: attempt.accountId,
      submissionId,
      systemCode: profile.systemCode,
      avatarId: `avatar_${challenge.definition.loadouts[0].robotId}`,
      score: result.score,
      completionMs: submission.request.completionMs,
      turns: result.totalTurns,
      completionStatus: submission.request.completionStatus,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing !== undefined && compareLeaderboard(existing, candidate) <= 0)
      return { challengeId: attempt.challengeId, leaderboardChanged: false };
    this.#leaderboard.set(key, candidate);
    return { challengeId: attempt.challengeId, leaderboardChanged: true };
  }

  public async listLeaderboard(
    challengeId: string,
    offset: number,
    limit: number,
  ): Promise<readonly StoredLeaderboardEntry[]> {
    return sortedLeaderboard(this.#leaderboard, challengeId)
      .slice(offset, offset + limit)
      .map(clone);
  }

  public async getLeaderboardEntry(
    challengeId: string,
    accountId: string,
  ): Promise<{ readonly entry: StoredLeaderboardEntry; readonly rank: number } | null> {
    const entries = sortedLeaderboard(this.#leaderboard, challengeId);
    const index = entries.findIndex((entry) => entry.accountId === accountId);
    if (index < 0) return null;
    const entry = entries.at(index);
    return entry === undefined ? null : { entry: clone(entry), rank: index + 1 };
  }

  public async close(): Promise<void> {
    await Promise.resolve();
  }

  public health(): Promise<void> {
    return Promise.resolve();
  }

  private assertAccount(accountId: string): void {
    if (!this.#accounts.has(accountId)) throw new Error("account not found");
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : clone(value);
}

function sortedLeaderboard(
  entries: ReadonlyMap<string, StoredLeaderboardEntry>,
  challengeId: string,
): StoredLeaderboardEntry[] {
  return [...entries.values()]
    .filter((entry) => entry.challengeId === challengeId)
    .sort(compareLeaderboard);
}

function compareLeaderboard(left: StoredLeaderboardEntry, right: StoredLeaderboardEntry): number {
  return (
    right.score - left.score ||
    left.completionMs - right.completionMs ||
    left.turns - right.turns ||
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}
