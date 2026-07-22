import { createHash, timingSafeEqual } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";

import {
  adminSessionRequestSchema,
  announcementRequestSchema,
  confirmedAdminActionSchema,
  riskSwitchRequestSchema,
} from "@skymenders/protocol";
import type {
  AdminAuditEntry,
  AdminContentState,
  AdminContentVersion,
  AdminRole,
  AdminSessionResponse,
} from "@skymenders/protocol";
import type { AccessTokenService } from "@skymenders/security";
import { CURRENT_PRODUCT_VERSIONS } from "@skymenders/shared-types";
import { signArtifact } from "@skymenders/content-pipeline";

import {
  ADMIN_ACCESS_TOKENS,
  ADMIN_REPOSITORY,
  CONTENT_REGISTRY,
} from "../core/admin-contracts.js";
import type {
  AdminRepository,
  AnnouncementRecord,
  OperationalActionRecord,
} from "../core/admin-contracts.js";
import { SERVER_CLOCK, SERVER_CONFIG } from "../core/contracts.js";
import type { ServerClock } from "../core/contracts.js";
import type { ServerConfig } from "../core/server-config.js";
import { ApiError } from "../http/api-error.js";
import { ContentRegistry } from "../infrastructure/content-registry.js";
import { DailyChallengeService } from "./daily-challenge.service.js";

interface AdminIdentity {
  readonly adminId: string;
  readonly role: AdminRole;
}

@Injectable()
export class AdminService {
  public constructor(
    @Inject(ADMIN_REPOSITORY) private readonly repository: AdminRepository,
    @Inject(ADMIN_ACCESS_TOKENS) private readonly tokens: AccessTokenService,
    @Inject(CONTENT_REGISTRY) private readonly content: ContentRegistry,
    @Inject(SERVER_CONFIG) private readonly config: ServerConfig,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
    @Inject(DailyChallengeService) private readonly challenges: DailyChallengeService,
  ) {}

  public async createSession(input: unknown): Promise<AdminSessionResponse> {
    const request = adminSessionRequestSchema.parse(input);
    if (!safeSecretEqual(request.bootstrapToken, this.config.adminBootstrapToken))
      throw new ApiError(401, "ADMIN_BOOTSTRAP_INVALID", "Admin bootstrap exchange failed");
    const now = this.clock.now();
    const admin = await this.repository.ensureBootstrapAdmin(request.adminCode, now);
    const session = {
      id: uuidv7({ msecs: now.getTime() }),
      adminId: admin.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
      revokedAt: null,
    };
    await this.repository.createSession(session);
    const issued = await this.tokens.issue({ accountId: admin.id, sessionId: session.id }, now);
    await this.audit(
      admin.id,
      "admin.session.created",
      "admin_session",
      session.id,
      "short-lived admin login",
      null,
      { expiresAt: session.expiresAt.toISOString() },
    );
    return {
      accessToken: issued.token,
      expiresAt: issued.expiresAt.toISOString(),
      role: admin.role,
    };
  }

  public async overview(identity: AdminIdentity) {
    const versions = await this.contentVersions(identity);
    const [riskSwitches, announcements, actions] = await Promise.all([
      this.repository.listRiskSwitches(),
      this.repository.listAnnouncements(),
      this.repository.listOperationalActions(20),
    ]);
    return {
      versions: CURRENT_PRODUCT_VERSIONS,
      contentVersions: versions,
      riskSwitches,
      announcements,
      recentOperationalActions: actions,
      modules: [
        "content_approval",
        "daily_preview",
        "leaderboard_verification",
        "score_quarantine",
        "system_code_reset",
        "deletion_processing",
        "service_health",
        "compatibility",
        "audit",
        "announcements",
        "risk_switches",
      ],
    };
  }

  public async contentVersions(identity: AdminIdentity): Promise<readonly AdminContentVersion[]> {
    await this.ensureEmbeddedVersion(identity.adminId);
    return this.repository.listContentVersions();
  }

  public async approveContent(
    identity: AdminIdentity,
    id: string,
    input: unknown,
  ): Promise<AdminContentVersion> {
    requireRole(identity.role, ["content_reviewer", "owner"]);
    return this.transition(identity, id, "staged", "approved", input, `APPROVE CONTENT ${id}`);
  }

  public async publishContent(
    identity: AdminIdentity,
    id: string,
    input: unknown,
  ): Promise<AdminContentVersion> {
    requireRole(identity.role, ["owner"]);
    return this.transition(identity, id, "signed", "published", input, `PUBLISH CONTENT ${id}`);
  }

  public async signContent(
    identity: AdminIdentity,
    id: string,
    input: unknown,
  ): Promise<AdminContentVersion> {
    requireRole(identity.role, ["owner"]);
    const signature = signArtifact(id, this.config.contentSigningSecret);
    return this.transition(
      identity,
      id,
      "approved",
      "signed",
      input,
      `SIGN CONTENT ${id}`,
      signature,
    );
  }

  public async freezeContent(
    identity: AdminIdentity,
    id: string,
    input: unknown,
  ): Promise<AdminContentVersion> {
    requireRole(identity.role, ["owner"]);
    const current = (await this.contentVersions(identity)).find((version) => version.id === id);
    if (current === undefined)
      throw new ApiError(404, "CONTENT_VERSION_NOT_FOUND", "Content version not found");
    if (current.state !== "approved" && current.state !== "signed" && current.state !== "published")
      throw new ApiError(
        409,
        "CONTENT_STATE_CONFLICT",
        "Only approved, signed, or published content can be frozen",
      );
    return this.transition(identity, id, current.state, "frozen", input, `FREEZE CONTENT ${id}`);
  }

  public async rollbackContent(
    identity: AdminIdentity,
    id: string,
    input: unknown,
  ): Promise<AdminContentVersion> {
    requireRole(identity.role, ["owner"]);
    return this.transition(
      identity,
      id,
      "published",
      "rolled_back",
      input,
      `ROLLBACK CONTENT ${id}`,
    );
  }

  public async dailyPreview(identity: AdminIdentity) {
    requireRole(identity.role, ["viewer", "content_reviewer", "operator", "owner"]);
    return this.challenges.previewCurrentChallenge();
  }

  public async auditLog(
    identity: AdminIdentity,
    limit: number,
  ): Promise<readonly AdminAuditEntry[]> {
    requireRole(identity.role, ["content_reviewer", "operator", "owner"]);
    return this.repository.listAudit(Math.min(200, Math.max(1, limit)));
  }

  public async announcement(identity: AdminIdentity, input: unknown): Promise<AnnouncementRecord> {
    requireRole(identity.role, ["operator", "owner"]);
    const request = announcementRequestSchema.parse(input);
    const now = this.clock.now();
    const record: AnnouncementRecord = {
      id: uuidv7({ msecs: now.getTime() }),
      titleKey: request.titleKey,
      bodyKey: request.bodyKey,
      startsAt: new Date(request.startsAt),
      endsAt: new Date(request.endsAt),
      createdBy: identity.adminId,
      createdAt: now,
    };
    await this.repository.createAnnouncement(record);
    await this.audit(
      identity.adminId,
      "announcement.created",
      "announcement",
      record.id,
      request.reason,
      null,
      record,
    );
    return record;
  }

  public async riskSwitch(identity: AdminIdentity, key: string, input: unknown) {
    requireRole(identity.role, ["operator", "owner"]);
    if (!/^[a-z][a-z0-9_]{2,63}$/.test(key))
      throw new ApiError(400, "RISK_SWITCH_INVALID", "Invalid risk switch key");
    const request = riskSwitchRequestSchema.parse(input);
    const before =
      (await this.repository.listRiskSwitches()).find((entry) => entry.key === key) ?? null;
    const record = await this.repository.setRiskSwitch({
      key,
      enabled: request.enabled,
      reason: request.reason,
      updatedBy: identity.adminId,
      updatedAt: this.clock.now(),
    });
    await this.audit(
      identity.adminId,
      "risk_switch.updated",
      "risk_switch",
      key,
      request.reason,
      before,
      record,
    );
    return record;
  }

  public async operationalAction(
    identity: AdminIdentity,
    kind: OperationalActionRecord["kind"],
    targetId: string,
    input: unknown,
  ): Promise<OperationalActionRecord> {
    requireRole(identity.role, ["operator", "owner"]);
    const request = confirmedAdminActionSchema.parse(input);
    const expected = `${kind.toUpperCase()} ${targetId}`;
    if (request.confirmation !== expected)
      throw new ApiError(400, "CONFIRMATION_REQUIRED", `Confirmation must be ${expected}`);
    const now = this.clock.now();
    const record: OperationalActionRecord = {
      id: uuidv7({ msecs: now.getTime() }),
      kind,
      targetId,
      reason: request.reason,
      actorId: identity.adminId,
      createdAt: now,
    };
    await this.repository.createOperationalAction(record);
    await this.audit(
      identity.adminId,
      `operation.${kind}`,
      "operation_target",
      targetId,
      request.reason,
      null,
      record,
    );
    return record;
  }

  private async ensureEmbeddedVersion(actorId: string): Promise<void> {
    const current = this.content.current();
    if (current === null) return;
    if (
      (await this.repository.listContentVersions()).some(
        (version) => version.id === current.manifest.artifactHash,
      )
    )
      return;
    const version = await this.repository.ensureContentVersion({
      id: current.manifest.artifactHash,
      contentVersion: current.manifest.contentVersion,
      artifactHash: current.manifest.artifactHash,
      manifest: current.manifest,
      actorId,
      now: this.clock.now(),
    });
    await this.audit(
      actorId,
      "content.staged",
      "content_version",
      version.id,
      "validated embedded content registered for review",
      null,
      version,
    );
  }

  private async transition(
    identity: AdminIdentity,
    id: string,
    expected: AdminContentState,
    next: AdminContentState,
    input: unknown,
    confirmation: string,
    signature?: string,
  ): Promise<AdminContentVersion> {
    const request = confirmedAdminActionSchema.parse(input);
    if (request.confirmation !== confirmation)
      throw new ApiError(400, "CONFIRMATION_REQUIRED", `Confirmation must be ${confirmation}`);
    await this.ensureEmbeddedVersion(identity.adminId);
    const before =
      (await this.repository.listContentVersions()).find((version) => version.id === id) ?? null;
    const updated = await this.repository.transitionContentVersion(
      id,
      expected,
      next,
      identity.adminId,
      this.clock.now(),
      signature,
    );
    if (updated === null)
      throw new ApiError(409, "CONTENT_STATE_CONFLICT", `Expected content state ${expected}`);
    await this.audit(
      identity.adminId,
      `content.${next}`,
      "content_version",
      id,
      request.reason,
      before,
      updated,
    );
    return updated;
  }

  private async audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    reason: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    const previousHash = await this.repository.latestAuditHash();
    const createdAt = this.clock.now().toISOString();
    const id = uuidv7({ msecs: this.clock.now().getTime() });
    const entryHash = digest({
      id,
      actorId,
      action,
      targetType,
      targetId,
      reason,
      previousHash,
      before,
      after,
      createdAt,
    });
    await this.repository.appendAudit({
      id,
      actorId,
      action,
      targetType,
      targetId,
      reason,
      previousHash,
      entryHash,
      createdAt,
    });
  }
}

function requireRole(role: AdminRole, allowed: readonly AdminRole[]): void {
  if (!allowed.includes(role))
    throw new ApiError(403, "ADMIN_ROLE_FORBIDDEN", "The admin role cannot perform this operation");
}

function safeSecretEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
