import { PrismaPg } from "@prisma/adapter-pg";
import { v7 as uuidv7 } from "uuid";

import {
  adminAuditEntrySchema,
  adminContentVersionSchema,
  adminRoleSchema,
  publishedContentManifestSchema,
} from "@skymenders/protocol";
import type { AdminAuditEntry, AdminContentState, AdminContentVersion } from "@skymenders/protocol";

import type {
  AdminRepository,
  AdminSessionRecord,
  AdminUserRecord,
  AnnouncementRecord,
  OperationalActionRecord,
  RiskSwitchRecord,
} from "../core/admin-contracts.js";
import { PrismaClient } from "../generated/prisma/client.js";
import type { Prisma } from "../generated/prisma/client.js";

export class PrismaAdminRepository implements AdminRepository {
  readonly #client: PrismaClient;

  public constructor(connectionString: string) {
    if (
      !connectionString.startsWith("postgresql://") &&
      !connectionString.startsWith("postgres://")
    )
      throw new Error("DATABASE_URL must use PostgreSQL");
    this.#client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  public async ensureBootstrapAdmin(code: string, now: Date): Promise<AdminUserRecord> {
    const row = await this.#client.adminUser.upsert({
      where: { code },
      create: {
        id: uuidv7({ msecs: now.getTime() }),
        code,
        role: "owner",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      update: {},
    });
    return {
      id: row.id,
      code: row.code,
      role: adminRoleSchema.parse(row.role),
      active: row.active,
      createdAt: row.createdAt,
    };
  }

  public async findAdmin(adminId: string): Promise<AdminUserRecord | null> {
    const row = await this.#client.adminUser.findUnique({ where: { id: adminId } });
    return row === null
      ? null
      : {
          id: row.id,
          code: row.code,
          role: adminRoleSchema.parse(row.role),
          active: row.active,
          createdAt: row.createdAt,
        };
  }

  public async createSession(session: AdminSessionRecord): Promise<void> {
    await this.#client.adminSession.create({ data: session });
  }

  public async findSession(sessionId: string): Promise<AdminSessionRecord | null> {
    const row = await this.#client.adminSession.findUnique({ where: { id: sessionId } });
    return row;
  }

  public async ensureContentVersion(
    input: Parameters<AdminRepository["ensureContentVersion"]>[0],
  ): Promise<AdminContentVersion> {
    const row = await this.#client.contentVersion.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        contentVersion: input.contentVersion,
        artifactHash: input.artifactHash,
        state: "staged",
        manifest: json(input.manifest),
        createdBy: input.actorId,
        approvedBy: null,
        signature: null,
        createdAt: input.now,
        updatedAt: input.now,
      },
      update: {},
    });
    return contentVersion(row);
  }

  public async listContentVersions(): Promise<readonly AdminContentVersion[]> {
    return (await this.#client.contentVersion.findMany({ orderBy: { createdAt: "desc" } })).map(
      contentVersion,
    );
  }

  public async transitionContentVersion(
    id: string,
    expected: AdminContentState,
    next: AdminContentState,
    actorId: string,
    now: Date,
    signature?: string,
  ): Promise<AdminContentVersion | null> {
    const result = await this.#client.contentVersion.updateMany({
      where: { id, state: expected },
      data: {
        state: next,
        updatedAt: now,
        ...(next === "approved" ? { approvedBy: actorId } : {}),
        ...(signature === undefined ? {} : { signature }),
      },
    });
    if (result.count !== 1) return null;
    return contentVersion(await this.#client.contentVersion.findUniqueOrThrow({ where: { id } }));
  }

  public async latestAuditHash(): Promise<string | null> {
    return (
      (
        await this.#client.adminAuditLog.findFirst({
          orderBy: { createdAt: "desc" },
          select: { entryHash: true },
        })
      )?.entryHash ?? null
    );
  }

  public async appendAudit(entry: AdminAuditEntry): Promise<void> {
    await this.#client.adminAuditLog.create({
      data: { ...entry, createdAt: new Date(entry.createdAt) },
    });
  }

  public async listAudit(limit: number): Promise<readonly AdminAuditEntry[]> {
    const rows = await this.#client.adminAuditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) =>
      adminAuditEntrySchema.parse({ ...row, createdAt: row.createdAt.toISOString() }),
    );
  }

  public async createAnnouncement(record: AnnouncementRecord): Promise<void> {
    await this.#client.adminAnnouncement.create({ data: record });
  }

  public async listAnnouncements(): Promise<readonly AnnouncementRecord[]> {
    return this.#client.adminAnnouncement.findMany({ orderBy: { startsAt: "desc" } });
  }

  public async setRiskSwitch(record: RiskSwitchRecord): Promise<RiskSwitchRecord> {
    return this.#client.adminRiskSwitch.upsert({
      where: { key: record.key },
      create: record,
      update: record,
    });
  }

  public async listRiskSwitches(): Promise<readonly RiskSwitchRecord[]> {
    return this.#client.adminRiskSwitch.findMany({ orderBy: { key: "asc" } });
  }

  public async createOperationalAction(record: OperationalActionRecord): Promise<void> {
    await this.#client.adminOperationalAction.create({ data: record });
  }

  public async listOperationalActions(limit: number): Promise<readonly OperationalActionRecord[]> {
    const rows = await this.#client.adminOperationalAction.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({ ...row, kind: operationalKind(row.kind) }));
  }

  public async health(): Promise<void> {
    await this.#client.$queryRaw`SELECT 1`;
  }
  public async close(): Promise<void> {
    await this.#client.$disconnect();
  }
}

type ContentVersionRow = Awaited<ReturnType<PrismaClient["contentVersion"]["findUniqueOrThrow"]>>;

function contentVersion(row: ContentVersionRow): AdminContentVersion {
  return adminContentVersionSchema.parse({
    id: row.id,
    contentVersion: row.contentVersion,
    artifactHash: row.artifactHash,
    state: row.state,
    manifest: publishedContentManifestSchema.parse(row.manifest),
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    signature: row.signature,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function operationalKind(value: string): OperationalActionRecord["kind"] {
  if (
    value === "score_quarantine" ||
    value === "system_code_reset" ||
    value === "deletion_processing"
  )
    return value;
  throw new Error(`unknown operational action kind: ${value}`);
}
