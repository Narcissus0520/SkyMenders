import type {
  AccountProgressSave,
  DeviceKind,
  ExpeditionSaveDocument,
  PrivacyRequestResponse,
  ProfileSettings,
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
