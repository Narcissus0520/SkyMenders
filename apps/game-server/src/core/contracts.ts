import type {
  AccountProgressSave,
  DailyAttemptCheckpointRequest,
  DailyAttemptMode,
  DailyAttemptStatus,
  DailyChallengeDefinition,
  DeviceKind,
  ExpeditionSaveDocument,
  FinishDailyAttemptRequest,
  LeaderboardEntry,
  PrivacyRequestResponse,
  ProfileSettings,
  ReplayVerificationResult,
} from "@skymenders/protocol";

export interface AccountRecord {
  readonly id: string;
  readonly createdAt: Date;
}

export interface SessionRecord {
  readonly id: string;
  readonly accountId: string;
  readonly refreshTokenHash: string;
  readonly deviceKind: DeviceKind;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export interface ProfileRecord {
  readonly accountId: string;
  readonly systemCode: string;
  readonly settings: ProfileSettings;
}

export interface PrivacyRecord extends PrivacyRequestResponse {
  readonly accountId: string | null;
}

export interface StoredHttpResult {
  readonly statusCode: number;
  readonly response: unknown;
}

export interface DailyChallengeRecord {
  readonly id: string;
  readonly definition: DailyChallengeDefinition;
  readonly createdAt: Date;
}

export interface DailyAttemptRecord {
  readonly id: string;
  readonly accountId: string;
  readonly challengeId: string;
  readonly mode: DailyAttemptMode;
  readonly formalSlot: number | null;
  readonly status: DailyAttemptStatus;
  readonly checkpointIndex: number | null;
  readonly checkpoint: DailyAttemptCheckpointRequest | null;
  readonly startedAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

export interface ReplaySubmissionRecord {
  readonly id: string;
  readonly attemptId: string;
  readonly request: FinishDailyAttemptRequest;
  readonly status: "queued" | "verifying" | "verified" | "rejected";
  readonly score: number | null;
  readonly totalTurns: number | null;
  readonly rejectionCode: ReplayVerificationResult["rejectionCode"];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly verifiedAt: Date | null;
}

export interface ReplayVerificationContext {
  readonly submission: ReplaySubmissionRecord;
  readonly challenge: DailyChallengeRecord;
}

export interface StoredLeaderboardEntry extends Omit<LeaderboardEntry, "rank"> {
  readonly id: string;
  readonly challengeId: string;
  readonly accountId: string;
  readonly submissionId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SaveArchiveInput {
  readonly kind: "superseded" | "conflict" | "deleted";
  readonly document: ExpeditionSaveDocument;
  readonly expiresAt: Date;
}

export interface AccountExport {
  readonly account: AccountRecord;
  readonly profile: ProfileRecord;
  readonly progress: AccountProgressSave;
  readonly expeditionSave: ExpeditionSaveDocument | null;
  readonly sessions: readonly Omit<SessionRecord, "refreshTokenHash">[];
}

export interface GameRepository {
  findOrCreateAccount(platform: "wechat", subjectHash: string, now: Date): Promise<AccountRecord>;
  findAccount(accountId: string): Promise<AccountRecord | null>;
  createSession(session: SessionRecord): Promise<void>;
  findSessionByRefreshHash(hash: string): Promise<SessionRecord | null>;
  findSession(sessionId: string): Promise<SessionRecord | null>;
  rotateSession(sessionId: string, refreshTokenHash: string, expiresAt: Date): Promise<void>;
  revokeSessionByRefreshHash(hash: string, now: Date): Promise<void>;
  revokeAllSessions(accountId: string, now: Date): Promise<void>;
  getProfile(accountId: string): Promise<ProfileRecord | null>;
  updateProfileSettings(accountId: string, settings: ProfileSettings): Promise<ProfileRecord>;
  getProgress(accountId: string): Promise<AccountProgressSave | null>;
  putProgress(accountId: string, progress: AccountProgressSave): Promise<void>;
  getExpeditionSave(accountId: string): Promise<ExpeditionSaveDocument | null>;
  commitExpeditionSave(
    accountId: string,
    expectedRevision: number | null,
    document: ExpeditionSaveDocument,
    archive: SaveArchiveInput | null,
  ): Promise<boolean>;
  deleteExpeditionSave(accountId: string): Promise<void>;
  archiveSave(
    accountId: string,
    kind: "superseded" | "conflict" | "deleted",
    document: ExpeditionSaveDocument,
    expiresAt: Date,
  ): Promise<void>;
  createPrivacyRequest(record: PrivacyRecord): Promise<void>;
  updatePrivacyRequest(
    requestId: string,
    status: PrivacyRequestResponse["status"],
    completedAt: Date | null,
  ): Promise<PrivacyRecord>;
  getPrivacyRequest(accountId: string, requestId: string): Promise<PrivacyRecord | null>;
  exportAccount(accountId: string): Promise<AccountExport | null>;
  hardDeleteAccount(accountId: string): Promise<void>;
  getIdempotency(
    accountId: string,
    route: string,
    key: string,
    now: Date,
  ): Promise<StoredHttpResult | null>;
  putIdempotency(
    accountId: string,
    route: string,
    key: string,
    result: StoredHttpResult,
    expiresAt: Date,
  ): Promise<void>;
  ensureDailyChallenge(record: DailyChallengeRecord): Promise<DailyChallengeRecord>;
  getDailyChallenge(challengeId: string): Promise<DailyChallengeRecord | null>;
  countFormalAttempts(accountId: string, challengeId: string): Promise<number>;
  findActiveDailyAttempt(
    accountId: string,
    challengeId: string,
  ): Promise<DailyAttemptRecord | null>;
  createPracticeAttempt(record: DailyAttemptRecord): Promise<DailyAttemptRecord>;
  createFormalAttempt(record: DailyAttemptRecord): Promise<DailyAttemptRecord | null>;
  getDailyAttempt(accountId: string, attemptId: string): Promise<DailyAttemptRecord | null>;
  saveDailyCheckpoint(
    accountId: string,
    attemptId: string,
    checkpoint: DailyAttemptCheckpointRequest,
    now: Date,
  ): Promise<boolean>;
  abandonDailyAttempt(accountId: string, attemptId: string, now: Date): Promise<boolean>;
  submitDailyAttempt(
    accountId: string,
    attemptId: string,
    request: FinishDailyAttemptRequest,
    now: Date,
  ): Promise<ReplaySubmissionRecord | null>;
  getReplaySubmission(submissionId: string): Promise<ReplaySubmissionRecord | null>;
  getReplayVerificationContext(submissionId: string): Promise<ReplayVerificationContext | null>;
  completeReplaySubmission(
    submissionId: string,
    result: ReplayVerificationResult,
    now: Date,
  ): Promise<{ readonly challengeId: string; readonly leaderboardChanged: boolean } | null>;
  listLeaderboard(
    challengeId: string,
    offset: number,
    limit: number,
  ): Promise<readonly StoredLeaderboardEntry[]>;
  getLeaderboardEntry(
    challengeId: string,
    accountId: string,
  ): Promise<{ readonly entry: StoredLeaderboardEntry; readonly rank: number } | null>;
  health(): Promise<void>;
  close(): Promise<void>;
}

export interface ReplayVerificationQueue {
  enqueue(submissionId: string): Promise<void>;
  health(): Promise<void>;
  close(): Promise<void>;
}

export interface LeaderboardCache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  invalidateChallenge(challengeId: string): Promise<void>;
  health(): Promise<void>;
  close(): Promise<void>;
}

export interface WechatCodeExchange {
  exchange(code: string): Promise<{ readonly openId: string }>;
}

export interface ServerClock {
  now(): Date;
}

export const GAME_REPOSITORY = Symbol("GAME_REPOSITORY");
export const WECHAT_CODE_EXCHANGE = Symbol("WECHAT_CODE_EXCHANGE");
export const SERVER_CLOCK = Symbol("SERVER_CLOCK");
export const SERVER_CONFIG = Symbol("SERVER_CONFIG");
export const REPLAY_VERIFICATION_QUEUE = Symbol("REPLAY_VERIFICATION_QUEUE");
export const LEADERBOARD_CACHE = Symbol("LEADERBOARD_CACHE");
export const CHALLENGE_CONTENT = Symbol("CHALLENGE_CONTENT");
