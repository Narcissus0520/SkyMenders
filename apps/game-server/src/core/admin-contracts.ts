import type {
  AdminAuditEntry,
  AdminContentState,
  AdminContentVersion,
  AdminRole,
  PublishedContentManifest,
} from "@skymenders/protocol";

export interface AdminUserRecord {
  readonly id: string;
  readonly code: string;
  readonly role: AdminRole;
  readonly active: boolean;
  readonly createdAt: Date;
}

export interface AdminSessionRecord {
  readonly id: string;
  readonly adminId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export interface AnnouncementRecord {
  readonly id: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface RiskSwitchRecord {
  readonly key: string;
  readonly enabled: boolean;
  readonly reason: string;
  readonly updatedBy: string;
  readonly updatedAt: Date;
}

export interface OperationalActionRecord {
  readonly id: string;
  readonly kind: "score_quarantine" | "system_code_reset" | "deletion_processing";
  readonly targetId: string;
  readonly reason: string;
  readonly actorId: string;
  readonly createdAt: Date;
}

export interface AdminRepository {
  ensureBootstrapAdmin(code: string, now: Date): Promise<AdminUserRecord>;
  findAdmin(adminId: string): Promise<AdminUserRecord | null>;
  createSession(session: AdminSessionRecord): Promise<void>;
  findSession(sessionId: string): Promise<AdminSessionRecord | null>;
  ensureContentVersion(input: {
    readonly id: string;
    readonly contentVersion: string;
    readonly artifactHash: string;
    readonly manifest: PublishedContentManifest;
    readonly actorId: string;
    readonly now: Date;
  }): Promise<AdminContentVersion>;
  listContentVersions(): Promise<readonly AdminContentVersion[]>;
  transitionContentVersion(
    id: string,
    expected: AdminContentState,
    next: AdminContentState,
    actorId: string,
    now: Date,
    signature?: string,
  ): Promise<AdminContentVersion | null>;
  latestAuditHash(): Promise<string | null>;
  appendAudit(entry: AdminAuditEntry): Promise<void>;
  listAudit(limit: number): Promise<readonly AdminAuditEntry[]>;
  createAnnouncement(record: AnnouncementRecord): Promise<void>;
  listAnnouncements(): Promise<readonly AnnouncementRecord[]>;
  setRiskSwitch(record: RiskSwitchRecord): Promise<RiskSwitchRecord>;
  listRiskSwitches(): Promise<readonly RiskSwitchRecord[]>;
  createOperationalAction(record: OperationalActionRecord): Promise<void>;
  listOperationalActions(limit: number): Promise<readonly OperationalActionRecord[]>;
  health(): Promise<void>;
  close(): Promise<void>;
}

export const ADMIN_REPOSITORY = Symbol("ADMIN_REPOSITORY");
export const ADMIN_ACCESS_TOKENS = Symbol("ADMIN_ACCESS_TOKENS");
export const CONTENT_REGISTRY = Symbol("CONTENT_REGISTRY");
