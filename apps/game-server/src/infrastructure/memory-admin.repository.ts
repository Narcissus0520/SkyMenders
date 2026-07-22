/* eslint-disable @typescript-eslint/require-await -- in-memory adapter mirrors async production contract */
import { v7 as uuidv7 } from "uuid";

import type { AdminAuditEntry, AdminContentVersion } from "@skymenders/protocol";

import type {
  AdminRepository,
  AdminSessionRecord,
  AdminUserRecord,
  AnnouncementRecord,
  OperationalActionRecord,
  RiskSwitchRecord,
} from "../core/admin-contracts.js";

export class MemoryAdminRepository implements AdminRepository {
  readonly #admins = new Map<string, AdminUserRecord>();
  readonly #sessions = new Map<string, AdminSessionRecord>();
  readonly #versions = new Map<string, AdminContentVersion>();
  readonly #audit: AdminAuditEntry[] = [];
  readonly #announcements: AnnouncementRecord[] = [];
  readonly #switches = new Map<string, RiskSwitchRecord>();
  readonly #actions: OperationalActionRecord[] = [];

  public async ensureBootstrapAdmin(code: string, now: Date): Promise<AdminUserRecord> {
    const existing = [...this.#admins.values()].find((admin) => admin.code === code);
    if (existing !== undefined) return clone(existing);
    const record: AdminUserRecord = {
      id: uuidv7({ msecs: now.getTime() }),
      code,
      role: "owner",
      active: true,
      createdAt: now,
    };
    this.#admins.set(record.id, record);
    return clone(record);
  }

  public async findAdmin(adminId: string): Promise<AdminUserRecord | null> {
    return cloneNullable(this.#admins.get(adminId));
  }

  public async createSession(session: AdminSessionRecord): Promise<void> {
    this.#sessions.set(session.id, clone(session));
  }

  public async findSession(sessionId: string): Promise<AdminSessionRecord | null> {
    return cloneNullable(this.#sessions.get(sessionId));
  }

  public async ensureContentVersion(
    input: Parameters<AdminRepository["ensureContentVersion"]>[0],
  ): Promise<AdminContentVersion> {
    const existing = this.#versions.get(input.id);
    if (existing !== undefined) return clone(existing);
    const value: AdminContentVersion = {
      id: input.id,
      contentVersion: input.contentVersion,
      artifactHash: input.artifactHash,
      state: "staged",
      manifest: input.manifest,
      createdBy: input.actorId,
      approvedBy: null,
      signature: null,
      createdAt: input.now.toISOString(),
      updatedAt: input.now.toISOString(),
    };
    this.#versions.set(value.id, value);
    return clone(value);
  }

  public async listContentVersions(): Promise<readonly AdminContentVersion[]> {
    return [...this.#versions.values()]
      .map(clone)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async transitionContentVersion(
    id: string,
    expected: AdminContentVersion["state"],
    next: AdminContentVersion["state"],
    actorId: string,
    now: Date,
    signature?: string,
  ): Promise<AdminContentVersion | null> {
    const current = this.#versions.get(id);
    if (current?.state !== expected) return null;
    const updated: AdminContentVersion = {
      ...current,
      state: next,
      updatedAt: now.toISOString(),
      ...(next === "approved" ? { approvedBy: actorId } : {}),
      ...(signature === undefined ? {} : { signature }),
    };
    this.#versions.set(id, updated);
    return clone(updated);
  }

  public async latestAuditHash(): Promise<string | null> {
    return this.#audit.at(-1)?.entryHash ?? null;
  }
  public async appendAudit(entry: AdminAuditEntry): Promise<void> {
    this.#audit.push(clone(entry));
  }
  public async listAudit(limit: number): Promise<readonly AdminAuditEntry[]> {
    return this.#audit.slice(-limit).reverse().map(clone);
  }
  public async createAnnouncement(record: AnnouncementRecord): Promise<void> {
    this.#announcements.push(clone(record));
  }
  public async listAnnouncements(): Promise<readonly AnnouncementRecord[]> {
    return this.#announcements.map(clone);
  }
  public async setRiskSwitch(record: RiskSwitchRecord): Promise<RiskSwitchRecord> {
    this.#switches.set(record.key, clone(record));
    return clone(record);
  }
  public async listRiskSwitches(): Promise<readonly RiskSwitchRecord[]> {
    return [...this.#switches.values()].map(clone);
  }
  public async createOperationalAction(record: OperationalActionRecord): Promise<void> {
    this.#actions.push(clone(record));
  }
  public async listOperationalActions(limit: number): Promise<readonly OperationalActionRecord[]> {
    return this.#actions.slice(-limit).reverse().map(clone);
  }
  public async health(): Promise<void> {
    return;
  }
  public async close(): Promise<void> {
    return;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
function cloneNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : clone(value);
}
