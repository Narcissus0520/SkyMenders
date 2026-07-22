/* eslint-disable @typescript-eslint/require-await -- synchronous test adapter implements async repository contract */
import { v7 as uuidv7 } from "uuid";

import type {
  AccountProgressSave,
  ExpeditionSaveDocument,
  ProfileSettings,
} from "@skymenders/protocol";

import {
  createInitialProgress,
  createSystemCode,
  DEFAULT_PROFILE_SETTINGS,
} from "../core/defaults.js";
import type {
  AccountExport,
  AccountRecord,
  GameRepository,
  PrivacyRecord,
  ProfileRecord,
  SaveArchiveInput,
  SessionRecord,
  StoredHttpResult,
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

  public async close(): Promise<void> {
    await Promise.resolve();
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
