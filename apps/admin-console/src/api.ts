import { MemoryAdminSession } from "./session.js";

export interface ContentVersion {
  readonly id: string;
  readonly contentVersion: string;
  readonly artifactHash: string;
  readonly state: string;
  readonly createdAt: string;
  readonly approvedBy: string | null;
  readonly signature: string | null;
}

export interface Overview {
  readonly versions: Readonly<Record<string, string>>;
  readonly contentVersions: readonly ContentVersion[];
  readonly riskSwitches: readonly {
    readonly key: string;
    readonly enabled: boolean;
    readonly reason: string;
  }[];
  readonly announcements: readonly {
    readonly id: string;
    readonly titleKey: string;
    readonly startsAt: string;
    readonly endsAt: string;
  }[];
  readonly recentOperationalActions: readonly {
    readonly id: string;
    readonly kind: string;
    readonly targetId: string;
    readonly createdAt: string;
  }[];
  readonly modules: readonly string[];
}

export interface AuditEntry {
  readonly id: string;
  readonly actorId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly reason: string;
  readonly previousHash: string | null;
  readonly entryHash: string;
  readonly createdAt: string;
}

export class AdminApi {
  public constructor(private readonly session = new MemoryAdminSession()) {}

  public async login(
    adminCode: string,
    bootstrapToken: string,
  ): Promise<{ readonly role: string; readonly expiresAt: string }> {
    const result = await request<{
      readonly accessToken: string;
      readonly role: string;
      readonly expiresAt: string;
    }>("/v1/admin/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminCode, bootstrapToken }),
    });
    this.session.set(result.accessToken);
    return { role: result.role, expiresAt: result.expiresAt };
  }

  public logout(): void {
    this.session.clear();
  }
  public overview(): Promise<Overview> {
    return this.authorized("/v1/admin/overview");
  }
  public dailyPreview(): Promise<unknown> {
    return this.authorized("/v1/admin/daily/preview");
  }
  public audit(): Promise<readonly AuditEntry[]> {
    return this.authorized("/v1/admin/audit?limit=100");
  }
  public readiness(): Promise<{ readonly status: string }> {
    return request("/health/ready");
  }

  public contentAction(
    id: string,
    action: "approve" | "sign" | "publish" | "freeze" | "rollback",
    reason: string,
    confirmation: string,
  ): Promise<ContentVersion> {
    return this.authorized(`/v1/admin/content/versions/${id}/${action}`, {
      method: "POST",
      body: JSON.stringify({ reason, confirmation }),
    });
  }

  public riskSwitch(key: string, enabled: boolean, reason: string): Promise<unknown> {
    return this.authorized(`/v1/admin/risk-switches/${key}`, {
      method: "POST",
      body: JSON.stringify({ enabled, reason, confirmation: "UPDATE RISK SWITCH" }),
    });
  }

  public operationalAction(
    kind: "score_quarantine" | "system_code_reset" | "deletion_processing",
    targetId: string,
    reason: string,
    confirmation: string,
  ): Promise<unknown> {
    const path =
      kind === "score_quarantine"
        ? `/v1/admin/leaderboard/submissions/${targetId}/quarantine`
        : kind === "system_code_reset"
          ? `/v1/admin/accounts/${targetId}/system-code-reset`
          : `/v1/admin/privacy/deletion-requests/${targetId}/process`;
    return this.authorized(path, {
      method: "POST",
      body: JSON.stringify({ reason, confirmation }),
    });
  }

  public announcement(input: Readonly<Record<string, unknown>>): Promise<unknown> {
    return this.authorized("/v1/admin/announcements", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  private authorized<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.session.get();
    if (token === null) return Promise.reject(new Error("ADMIN_SESSION_MISSING"));
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    headers.set("authorization", `Bearer ${token}`);
    return request(path, {
      ...init,
      headers,
    });
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json()) as unknown;
  if (!response.ok)
    throw new Error(
      typeof data === "object" && data !== null ? JSON.stringify(data) : response.statusText,
    );
  return data as T;
}
