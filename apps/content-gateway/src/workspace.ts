import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  CONTENT_FILE_DESCRIPTORS,
  ContentPublicationError,
  createPublicationArtifact,
  diffContent,
  evaluatePublication,
  parseContentSnapshot,
  signArtifact,
  transitionPublication,
} from "@skymenders/content-pipeline";
import type {
  ContentCatalogKey,
  ContentFilePath,
  PublicationArtifact,
  PublicationState,
} from "@skymenders/content-pipeline";
import {
  catalogSchemas,
  formatZodIssues,
  localizationCatalogSchema,
} from "@skymenders/content-schema";
import type { ContentIssue, PveContentPack } from "@skymenders/content-schema";
import { ZodError } from "zod";

export interface CatalogDocument {
  readonly key: ContentCatalogKey;
  readonly path: ContentFilePath;
  readonly revision: string;
  readonly data: unknown;
}

export interface PublicationRecord {
  readonly id: string;
  readonly state: PublicationState;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly artifact: PublicationArtifact;
  readonly approvedBy?: string;
  readonly approvedAt?: string;
  readonly signature?: string;
  readonly publishedAt?: string;
  readonly rolledBackAt?: string;
  readonly rollbackTargetId?: string;
}

export interface ContentFreeze {
  readonly contentVersion: string;
  readonly reason: string;
  readonly actor: string;
  readonly createdAt: string;
}

export interface ContentWorkspaceOptions {
  readonly rootDirectory: string;
  readonly now?: () => Date;
}

const descriptorByKey = new Map<ContentCatalogKey, ContentFilePath>(CONTENT_FILE_DESCRIPTORS);

export class ContentWorkspace {
  private readonly contentDirectory: string;
  private readonly stateDirectory: string;
  private readonly now: () => Date;

  public constructor(options: ContentWorkspaceOptions) {
    this.contentDirectory = resolve(options.rootDirectory, "content");
    this.stateDirectory = resolve(options.rootDirectory, ".content-publications");
    this.now = options.now ?? (() => new Date());
  }

  public listCatalogs(): readonly {
    readonly key: ContentCatalogKey;
    readonly path: ContentFilePath;
  }[] {
    return CONTENT_FILE_DESCRIPTORS.map(([key, path]) => ({ key, path }));
  }

  public async readCatalog(key: ContentCatalogKey): Promise<CatalogDocument> {
    const path = requireCatalogPath(key);
    const raw = await readFile(resolve(this.contentDirectory, path), "utf8");
    return { key, path, revision: digest(raw), data: JSON.parse(raw) as unknown };
  }

  public async saveCatalog(
    key: ContentCatalogKey,
    expectedRevision: string,
    data: unknown,
    actor: string,
  ): Promise<CatalogDocument> {
    await this.assertNotFrozen();
    const current = await this.readCatalog(key);
    if (current.revision !== expectedRevision)
      throw new GatewayError("CATALOG_CONFLICT", 409, [], { currentRevision: current.revision });
    const parsed = parseSingleCatalog(key, data);
    if (!parsed.success) throw new GatewayError("CATALOG_INVALID", 422, parsed.issues);
    const raw = `${JSON.stringify(parsed.data, null, 2)}\n`;
    const absolute = resolve(this.contentDirectory, current.path);
    await atomicWrite(absolute, raw);
    const document = { ...current, data: parsed.data, revision: digest(raw) };
    await this.audit(actor, "catalog.saved", key, {
      before: current.revision,
      after: document.revision,
    });
    return document;
  }

  public async saveDraft(key: ContentCatalogKey, data: unknown, actor: string): Promise<void> {
    const path = resolve(this.stateDirectory, "drafts", `${key}.json`);
    await atomicWrite(
      path,
      `${JSON.stringify({ actor, savedAt: this.now().toISOString(), data }, null, 2)}\n`,
    );
  }

  public async readDraft(key: ContentCatalogKey): Promise<unknown> {
    try {
      const value = JSON.parse(
        await readFile(resolve(this.stateDirectory, "drafts", `${key}.json`), "utf8"),
      ) as {
        readonly data: unknown;
      };
      return value.data;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  public async validate(): Promise<ReturnType<typeof evaluatePublication>> {
    return evaluatePublication(await this.readPack());
  }

  public async diffAgainstPublication(id: string): Promise<ReturnType<typeof diffContent>> {
    const current = await this.readPack();
    const publication = await this.readPublication(id);
    const payload = JSON.parse(publication.artifact.payload) as { readonly content: unknown };
    return diffContent(payload.content, current);
  }

  public async buildPublication(input: {
    readonly actor: string;
    readonly rulesVersion: string;
    readonly commitSha: string;
  }): Promise<PublicationRecord> {
    await this.assertNotFrozen();
    const createdAt = this.now().toISOString();
    const artifact = createPublicationArtifact({
      pack: await this.readPack(),
      rulesVersion: input.rulesVersion,
      commitSha: input.commitSha,
      createdAt,
    });
    const record: PublicationRecord = {
      id: artifact.manifest.artifactHash,
      state: "validated",
      createdAt,
      createdBy: input.actor,
      artifact,
    };
    await this.writePublication(record);
    await this.audit(input.actor, "publication.validated", record.id, {
      contentVersion: artifact.manifest.contentVersion,
    });
    return record;
  }

  public stagePublication(id: string, actor: string): Promise<PublicationRecord> {
    return this.movePublication(id, "staged", actor, "publication.staged");
  }

  public async approvePublication(id: string, actor: string): Promise<PublicationRecord> {
    const current = await this.readPublication(id);
    if (current.createdBy === actor)
      throw new GatewayError("SEPARATION_OF_DUTIES_REQUIRED", 409, [], { createdBy: actor });
    const record: PublicationRecord = {
      ...current,
      state: transitionPublication(current.state, "approved"),
      approvedBy: actor,
      approvedAt: this.now().toISOString(),
    };
    await this.writePublication(record);
    await this.audit(actor, "publication.approved", id, {});
    return record;
  }

  public async signPublication(
    id: string,
    actor: string,
    secret: string,
  ): Promise<PublicationRecord> {
    const current = await this.readPublication(id);
    const record: PublicationRecord = {
      ...current,
      state: transitionPublication(current.state, "signed"),
      signature: signArtifact(current.artifact.manifest.artifactHash, secret),
    };
    await this.writePublication(record);
    await this.audit(actor, "publication.signed", id, {});
    return record;
  }

  public async publish(
    id: string,
    actor: string,
    confirmation: string,
  ): Promise<PublicationRecord> {
    if (confirmation !== id) throw new GatewayError("CONFIRMATION_REQUIRED", 400, []);
    const current = await this.readPublication(id);
    const record: PublicationRecord = {
      ...current,
      state: transitionPublication(current.state, "published"),
      publishedAt: this.now().toISOString(),
    };
    await this.writePublication(record);
    await atomicWrite(
      resolve(this.stateDirectory, "current.json"),
      `${JSON.stringify({ publicationId: id }, null, 2)}\n`,
    );
    await this.audit(actor, "publication.published", id, {});
    return record;
  }

  public async rollback(
    id: string,
    targetId: string,
    actor: string,
    confirmation: string,
  ): Promise<PublicationRecord> {
    if (confirmation !== `${id}:${targetId}`)
      throw new GatewayError("CONFIRMATION_REQUIRED", 400, []);
    if (id === targetId) throw new GatewayError("ROLLBACK_TARGET_INVALID", 409, []);
    const active = await this.currentPublicationId();
    if (active !== id) throw new GatewayError("ROLLBACK_SOURCE_NOT_ACTIVE", 409, []);
    const [current, target] = await Promise.all([
      this.readPublication(id),
      this.readPublication(targetId),
    ]);
    if (target.state !== "published") throw new GatewayError("ROLLBACK_TARGET_INVALID", 409, []);
    const record: PublicationRecord = {
      ...current,
      state: transitionPublication(current.state, "rolled_back"),
      rolledBackAt: this.now().toISOString(),
      rollbackTargetId: targetId,
    };
    await this.writePublication(record);
    await atomicWrite(
      resolve(this.stateDirectory, "current.json"),
      `${JSON.stringify({ publicationId: targetId }, null, 2)}\n`,
    );
    await this.audit(actor, "publication.rolled_back", id, { targetId });
    return record;
  }

  public async currentPublicationId(): Promise<string | null> {
    try {
      const value = JSON.parse(
        await readFile(resolve(this.stateDirectory, "current.json"), "utf8"),
      ) as { readonly publicationId?: unknown };
      return typeof value.publicationId === "string" ? value.publicationId : null;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  public async freeze(
    contentVersion: string,
    reason: string,
    actor: string,
  ): Promise<ContentFreeze> {
    const freeze: ContentFreeze = {
      contentVersion,
      reason,
      actor,
      createdAt: this.now().toISOString(),
    };
    await atomicWrite(
      resolve(this.stateDirectory, "freeze.json"),
      `${JSON.stringify(freeze, null, 2)}\n`,
    );
    await this.audit(actor, "content.frozen", contentVersion, { reason });
    return freeze;
  }

  public async currentFreeze(): Promise<ContentFreeze | null> {
    try {
      return JSON.parse(
        await readFile(resolve(this.stateDirectory, "freeze.json"), "utf8"),
      ) as ContentFreeze;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  public async readPublication(id: string): Promise<PublicationRecord> {
    assertId(id);
    try {
      return JSON.parse(await readFile(this.publicationPath(id), "utf8")) as PublicationRecord;
    } catch (error) {
      if (isMissing(error)) throw new GatewayError("PUBLICATION_NOT_FOUND", 404, []);
      throw error;
    }
  }

  private async readPack(): Promise<PveContentPack> {
    const entries = await Promise.all(
      CONTENT_FILE_DESCRIPTORS.map(async ([, path]) => {
        const raw = await readFile(resolve(this.contentDirectory, path), "utf8");
        return [path, JSON.parse(raw) as unknown] as const;
      }),
    );
    const parsed = parseContentSnapshot(Object.fromEntries(entries));
    if (parsed.pack === undefined)
      throw new GatewayError("CONTENT_INVALID", 422, parsed.report.issues);
    return parsed.pack;
  }

  private async movePublication(
    id: string,
    target: PublicationState,
    actor: string,
    action: string,
  ): Promise<PublicationRecord> {
    const current = await this.readPublication(id);
    const record = { ...current, state: transitionPublication(current.state, target) };
    await this.writePublication(record);
    await this.audit(actor, action, id, {});
    return record;
  }

  private async writePublication(record: PublicationRecord): Promise<void> {
    await atomicWrite(this.publicationPath(record.id), `${JSON.stringify(record, null, 2)}\n`);
  }

  private publicationPath(id: string): string {
    assertId(id);
    return resolve(this.stateDirectory, "records", `${id}.json`);
  }

  private async assertNotFrozen(): Promise<void> {
    const freeze = await this.currentFreeze();
    if (freeze !== null) throw new GatewayError("CONTENT_FROZEN", 423, [], freeze);
  }

  private async audit(
    actor: string,
    action: string,
    target: string,
    detail: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const path = resolve(this.stateDirectory, "audit.jsonl");
    await mkdir(dirname(path), { recursive: true });
    await appendFile(
      path,
      `${JSON.stringify({ at: this.now().toISOString(), actor, action, target, detail })}\n`,
      "utf8",
    );
  }
}

export class GatewayError extends Error {
  public constructor(
    public readonly code: string,
    public readonly statusCode: number,
    public readonly issues: readonly ContentIssue[],
    public readonly details: unknown = {},
  ) {
    super(code);
    this.name = "GatewayError";
  }
}

function requireCatalogPath(key: ContentCatalogKey): ContentFilePath {
  const path = descriptorByKey.get(key);
  if (path === undefined) throw new GatewayError("CATALOG_NOT_FOUND", 404, []);
  return path;
}

function parseSingleCatalog(
  key: ContentCatalogKey,
  data: unknown,
):
  | { readonly success: true; readonly data: unknown }
  | { readonly success: false; readonly issues: readonly ContentIssue[] } {
  const result =
    key === "localization"
      ? localizationCatalogSchema.safeParse(data)
      : catalogSchemas[key].safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, issues: formatZodIssues(result.error) };
}

async function atomicWrite(path: string, raw: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, raw, { encoding: "utf8", flag: "wx" });
  await rename(temporary, path);
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertId(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new GatewayError("PUBLICATION_ID_INVALID", 400, []);
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export function normalizeGatewayError(error: unknown): GatewayError {
  if (error instanceof GatewayError) return error;
  if (error instanceof ContentPublicationError)
    return new GatewayError(error.code, 422, error.issues);
  if (error instanceof ZodError) {
    return new GatewayError(
      "INVALID_REQUEST",
      400,
      error.issues.map((issue) => ({
        code: "INVALID_REQUEST",
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return new GatewayError(
      error.statusCode === 429 ? "RATE_LIMITED" : "REQUEST_REJECTED",
      error.statusCode,
      [],
    );
  }
  return new GatewayError("CONTENT_GATEWAY_FAILURE", 500, [], { message: String(error) });
}
