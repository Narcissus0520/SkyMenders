export interface CatalogDescriptor {
  readonly key: string;
  readonly path: string;
}

export interface Bootstrap {
  readonly sessionToken: string;
  readonly catalogs: readonly CatalogDescriptor[];
}

export interface CatalogDocument {
  readonly key: string;
  readonly path: string;
  readonly revision: string;
  readonly data: unknown;
}

export interface ValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly report: {
    readonly issues: readonly ValidationIssue[];
    readonly counts: Readonly<Record<string, number>>;
  };
  readonly simulation: {
    readonly seedCount: number;
    readonly passed: number;
    readonly failedSeeds: readonly number[];
  };
  readonly artifactHash: string;
}

export interface AuthorityCatalog {
  readonly modules: Readonly<Record<string, unknown>>;
  readonly ai: {
    readonly difficulties: Readonly<Record<string, unknown>>;
    readonly enemies: Readonly<Record<string, unknown>>;
    readonly eliteAffixes: Readonly<Record<string, unknown>>;
    readonly eliteTemplates: Readonly<Record<string, unknown>>;
    readonly bosses: Readonly<Record<string, unknown>>;
  };
}

export class ContentGatewayClient {
  private token = "";

  public async bootstrap(): Promise<Bootstrap> {
    const result = await request<Bootstrap>("/api/bootstrap");
    this.token = result.sessionToken;
    return result;
  }

  public readCatalog(key: string): Promise<CatalogDocument> {
    return request(`/api/catalogs/${encodeURIComponent(key)}`);
  }

  public authority(): Promise<AuthorityCatalog> {
    return request("/api/authority");
  }

  public saveCatalog(
    document: CatalogDocument,
    data: unknown,
    actor: string,
  ): Promise<CatalogDocument> {
    return this.write(`/api/catalogs/${encodeURIComponent(document.key)}`, "PUT", {
      expectedRevision: document.revision,
      data,
      actor,
    });
  }

  public saveDraft(key: string, data: unknown, actor: string): Promise<{ readonly saved: true }> {
    return this.write(`/api/drafts/${encodeURIComponent(key)}`, "PUT", { data, actor });
  }

  public validate(): Promise<ValidationResult> {
    return this.write("/api/validate", "POST", {});
  }

  public buildPublication(actor: string): Promise<{ readonly id: string; readonly state: string }> {
    return this.write("/api/publications", "POST", {
      actor,
      rulesVersion: "0.6.0",
      commitSha: "workspace-draft",
    });
  }

  public transition(
    id: string,
    action: "stage" | "approve",
    actor: string,
  ): Promise<{ readonly id: string; readonly state: string }> {
    return this.write(`/api/publications/${id}/${action}`, "POST", { actor });
  }

  public readDiff(id: string): Promise<readonly ContentDifference[]> {
    return request(`/api/publications/${id}/diff`);
  }

  private write<T>(path: string, method: "POST" | "PUT", body: unknown): Promise<T> {
    return request(path, {
      method,
      headers: { "content-type": "application/json", "x-content-session": this.token },
      body: JSON.stringify(body),
    });
  }
}

export interface ContentDifference {
  readonly path: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? JSON.stringify(body.error)
        : response.statusText;
    throw new Error(message);
  }
  return body as T;
}
