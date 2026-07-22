import { randomBytes } from "node:crypto";

import Fastify from "fastify";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  AI_DIFFICULTY_PROFILES,
  BOSS_DEFINITIONS,
  ELITE_AFFIX_DEFINITIONS,
  ELITE_TEMPLATE_DEFINITIONS,
  ENEMY_DEFINITIONS,
} from "@skymenders/ai-core";
import { MODULE_DEFINITIONS } from "@skymenders/battle-core";
import type { ContentCatalogKey } from "@skymenders/content-pipeline";

import { GatewayError, normalizeGatewayError } from "./workspace.js";
import type { ContentWorkspace } from "./workspace.js";

const catalogKeySchema = z.enum([
  "robots",
  "modules",
  "enemies",
  "bosses",
  "objectives",
  "maps",
  "regions",
  "events",
  "routes",
  "tutorials",
  "progression",
  "localization",
]);
const actorSchema = z.string().regex(/^[a-zA-Z0-9_.@-]{2,80}$/);
const idSchema = z.string().regex(/^[a-f0-9]{64}$/);

export interface ContentGatewayOptions {
  readonly workspace: ContentWorkspace;
  readonly sessionToken?: string;
  readonly signingSecret?: string;
}

export function createContentGateway(options: ContentGatewayOptions): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 5 * 1024 * 1024 });
  const sessionToken = options.sessionToken ?? randomBytes(32).toString("hex");
  app.setErrorHandler((error, _request, reply) => {
    const normalized = normalizeGatewayError(error);
    void reply.status(normalized.statusCode).send({
      error: { code: normalized.code, issues: normalized.issues, details: normalized.details },
    });
  });

  app.get("/health", () => ({ status: "ok", scope: "loopback-only" }));
  app.get("/api/bootstrap", () => ({
    sessionToken,
    catalogs: options.workspace.listCatalogs(),
  }));
  app.get("/api/catalogs", () => options.workspace.listCatalogs());
  app.get("/api/authority", () => ({
    modules: MODULE_DEFINITIONS,
    ai: {
      difficulties: AI_DIFFICULTY_PROFILES,
      enemies: ENEMY_DEFINITIONS,
      eliteAffixes: ELITE_AFFIX_DEFINITIONS,
      eliteTemplates: ELITE_TEMPLATE_DEFINITIONS,
      bosses: BOSS_DEFINITIONS,
    },
  }));
  app.get("/api/catalogs/:key", async (request) =>
    options.workspace.readCatalog(parseKey(request.params)),
  );
  app.get("/api/drafts/:key", async (request) => ({
    data: await options.workspace.readDraft(parseKey(request.params)),
  }));
  app.get("/api/freeze", async () => ({ freeze: await options.workspace.currentFreeze() }));

  app.put("/api/catalogs/:key", async (request) => {
    authorize(request, sessionToken);
    const body = z
      .object({ expectedRevision: z.string().length(64), data: z.unknown(), actor: actorSchema })
      .strict()
      .parse(request.body);
    return options.workspace.saveCatalog(
      parseKey(request.params),
      body.expectedRevision,
      body.data,
      body.actor,
    );
  });
  app.put("/api/drafts/:key", async (request) => {
    authorize(request, sessionToken);
    const body = z.object({ data: z.unknown(), actor: actorSchema }).strict().parse(request.body);
    await options.workspace.saveDraft(parseKey(request.params), body.data, body.actor);
    return { saved: true };
  });
  app.post("/api/validate", async (request) => {
    authorize(request, sessionToken);
    return options.workspace.validate();
  });
  app.get("/api/publications/:id/diff", async (request) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    return options.workspace.diffAgainstPublication(id);
  });
  app.post("/api/publications", async (request) => {
    authorize(request, sessionToken);
    const body = z
      .object({
        actor: actorSchema,
        rulesVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
        commitSha: z.string().min(7).max(64),
      })
      .strict()
      .parse(request.body);
    return options.workspace.buildPublication(body);
  });
  app.post("/api/publications/:id/stage", async (request) => {
    authorize(request, sessionToken);
    return options.workspace.stagePublication(parseId(request.params), parseActor(request.body));
  });
  app.post("/api/publications/:id/approve", async (request) => {
    authorize(request, sessionToken);
    return options.workspace.approvePublication(parseId(request.params), parseActor(request.body));
  });
  app.post("/api/publications/:id/sign", async (request) => {
    authorize(request, sessionToken);
    if (options.signingSecret === undefined)
      throw new Error("CONTENT_SIGNING_SECRET is not configured");
    return options.workspace.signPublication(
      parseId(request.params),
      parseActor(request.body),
      options.signingSecret,
    );
  });
  app.post("/api/publications/:id/publish", async (request) => {
    authorize(request, sessionToken);
    const body = z
      .object({ actor: actorSchema, confirmation: z.string() })
      .strict()
      .parse(request.body);
    return options.workspace.publish(parseId(request.params), body.actor, body.confirmation);
  });
  app.post("/api/publications/:id/rollback", async (request) => {
    authorize(request, sessionToken);
    const body = z
      .object({ actor: actorSchema, targetId: idSchema, confirmation: z.string() })
      .strict()
      .parse(request.body);
    return options.workspace.rollback(
      parseId(request.params),
      body.targetId,
      body.actor,
      body.confirmation,
    );
  });
  app.post("/api/freeze", async (request) => {
    authorize(request, sessionToken);
    const body = z
      .object({
        actor: actorSchema,
        contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
        reason: z.string().min(10).max(500),
        confirmation: z.literal("FREEZE"),
      })
      .strict()
      .parse(request.body);
    return options.workspace.freeze(body.contentVersion, body.reason, body.actor);
  });
  return app;
}

export function assertLoopbackHost(host: string): void {
  if (!["127.0.0.1", "::1", "localhost"].includes(host))
    throw new Error("content gateway must bind to a loopback address");
}

function authorize(request: FastifyRequest, expected: string): void {
  if (request.headers["x-content-session"] !== expected) {
    throw new GatewayError("CONTENT_SESSION_REQUIRED", 401, []);
  }
}

function parseKey(params: unknown): ContentCatalogKey {
  return catalogKeySchema.parse(z.object({ key: z.string() }).parse(params).key);
}

function parseId(params: unknown): string {
  return z.object({ id: idSchema }).parse(params).id;
}

function parseActor(body: unknown): string {
  return z.object({ actor: actorSchema }).strict().parse(body).actor;
}
