import { PrismaPg } from "@prisma/adapter-pg";
import { v7 as uuidv7 } from "uuid";

import {
  accountProgressSaveSchema,
  expeditionSaveDocumentSchema,
  privacyRequestResponseSchema,
  profileSettingsSchema,
} from "@skymenders/protocol";
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

  public async close(): Promise<void> {
    await this.#client.$disconnect();
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
