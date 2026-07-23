/* eslint-disable @typescript-eslint/require-await -- test adapter implements async external boundary */
import "reflect-metadata";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ServerClock, WechatCodeExchange } from "../src/core/contracts.js";
import type { ServerConfig } from "../src/core/server-config.js";
import { loadChallengeContent } from "../src/infrastructure/challenge-runtime.js";
import { MemoryAdminRepository } from "../src/infrastructure/memory-admin.repository.js";
import { MemoryGameRepository } from "../src/infrastructure/memory.repository.js";
import { createGameServer } from "../src/server.js";

const now = new Date("2026-07-23T03:00:00.000Z");
const clock: ServerClock = { now: () => new Date(now) };
const wechat: WechatCodeExchange = { exchange: async () => ({ openId: "never-exposed" }) };
const bootstrapToken = "integration-admin-bootstrap-token-with-thirty-two-bytes";
const config: ServerConfig = {
  nodeEnv: "test",
  port: 3_000,
  host: "127.0.0.1",
  databaseUrl: "postgresql://unused:unused@127.0.0.1:5432/unused",
  sessionPepper: "integration-session-pepper-with-thirty-two-bytes",
  accessTokenSecret: "integration-access-secret-with-thirty-two-bytes",
  wechatAppId: "test-app-id",
  wechatAppSecret: "server-only-test-secret",
  accessTokenIssuer: "skymenders-test",
  accessTokenAudience: "skymenders-client-test",
  redisUrl: "redis://127.0.0.1:6379",
  challengeSeedSecret: "integration-daily-challenge-secret-with-thirty-two-bytes",
  dailyChallengeTimeZone: "Asia/Shanghai",
  adminBootstrapToken: bootstrapToken,
  adminAccessTokenSecret: "integration-admin-access-secret-with-thirty-two-bytes",
  adminAccessTokenIssuer: "skymenders-admin-api-test",
  adminAccessTokenAudience: "skymenders-admin-console-test",
  contentSigningSecret: "integration-content-signing-secret-with-thirty-two-bytes",
};

describe("admin and content HTTP control plane", () => {
  let app: NestFastifyApplication;
  let server: FastifyInstance;

  beforeEach(async () => {
    app = await createGameServer({
      repository: new MemoryGameRepository(),
      adminRepository: new MemoryAdminRepository(),
      wechatCodeExchange: wechat,
      config,
      clock,
      challengeContent: loadChallengeContent(),
    });
    server = app.getHttpAdapter().getInstance();
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves only validated immutable content by declared version", async () => {
    const manifest = await server.inject({ method: "GET", url: "/v1/content/manifest" });
    expect(manifest.statusCode).toBe(200);
    const manifestBody = responseJson<{ artifactHash: string }>(manifest.body);
    expect(manifest.body).toContain('"contentVersion":"0.2.0"');
    expect(manifest.body).toContain('"rulesVersion":"0.6.0"');
    expect(manifestBody.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    const content = await server.inject({ method: "GET", url: "/v1/content/versions/0.2.0" });
    expect(content.statusCode).toBe(200);
    const contentBody = responseJson<{ content: { robots: { robots: unknown[] } } }>(content.body);
    expect(contentBody.content.robots.robots).toHaveLength(6);
    expect(
      (await server.inject({ method: "GET", url: "/v1/content/versions/9.9.9" })).statusCode,
    ).toBe(404);
  });

  it("isolates admin auth and records every privileged write in a linked audit chain", async () => {
    expect((await server.inject({ method: "GET", url: "/v1/admin/overview" })).statusCode).toBe(
      401,
    );
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/v1/admin/auth/session",
          payload: { adminCode: "release.owner", bootstrapToken: "x".repeat(32) },
        })
      ).statusCode,
    ).toBe(401);
    const login = await server.inject({
      method: "POST",
      url: "/v1/admin/auth/session",
      payload: { adminCode: "release.owner", bootstrapToken },
    });
    expect(login.statusCode).toBe(200);
    const token = responseJson<{ accessToken: string }>(login.body).accessToken;
    const headers = { authorization: `Bearer ${token}` };
    const overview = await server.inject({ method: "GET", url: "/v1/admin/overview", headers });
    expect(overview.statusCode).toBe(200);
    const version = responseJson<{ contentVersions: { id: string; state: string }[] }>(
      overview.body,
    ).contentVersions[0];
    if (version === undefined) throw new Error("content version was not registered");
    expect(version.state).toBe("staged");

    const rejected = await server.inject({
      method: "POST",
      url: `/v1/admin/content/versions/${version.id}/approve`,
      headers,
      payload: { reason: "Release review completed", confirmation: "APPROVE" },
    });
    expect(rejected.statusCode).toBe(400);
    const approved = await server.inject({
      method: "POST",
      url: `/v1/admin/content/versions/${version.id}/approve`,
      headers,
      payload: {
        reason: "Release review completed",
        confirmation: `APPROVE CONTENT ${version.id}`,
      },
    });
    expect(responseJson<{ state: string }>(approved.body).state).toBe("approved");
    const signed = await server.inject({
      method: "POST",
      url: `/v1/admin/content/versions/${version.id}/sign`,
      headers,
      payload: {
        reason: "Release artifact signing authorized",
        confirmation: `SIGN CONTENT ${version.id}`,
      },
    });
    const signedBody = responseJson<{ state: string; signature: string | null }>(signed.body);
    expect(signedBody.state).toBe("signed");
    expect(signedBody.signature).toMatch(/^[a-f0-9]{64}$/);
    const published = await server.inject({
      method: "POST",
      url: `/v1/admin/content/versions/${version.id}/publish`,
      headers,
      payload: {
        reason: "Production release authorized",
        confirmation: `PUBLISH CONTENT ${version.id}`,
      },
    });
    expect(responseJson<{ state: string }>(published.body).state).toBe("published");
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/v1/admin/risk-switches/pause_ranked_writes",
          headers,
          payload: {
            enabled: true,
            reason: "Incident response rehearsal",
            confirmation: "UPDATE RISK SWITCH",
          },
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/v1/admin/leaderboard/submissions/submission-1/quarantine",
          headers,
          payload: {
            reason: "Replay verification anomaly",
            confirmation: "SCORE_QUARANTINE submission-1",
          },
        })
      ).statusCode,
    ).toBe(201);

    const audit = await server.inject({ method: "GET", url: "/v1/admin/audit?limit=20", headers });
    expect(audit.statusCode).toBe(200);
    const entries = responseJson<
      {
        entryHash: string;
        previousHash: string | null;
        action: string;
      }[]
    >(audit.body);
    expect(entries.map((entry) => entry.action)).toEqual(
      expect.arrayContaining([
        "admin.session.created",
        "content.approved",
        "content.signed",
        "content.published",
        "risk_switch.updated",
        "operation.score_quarantine",
      ]),
    );
    expect(entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.entryHash))).toBe(true);
    expect(audit.body).not.toContain("never-exposed");
  });
});

// Call sites supply the narrow HTTP response shape used by each assertion.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function responseJson<T>(body: string): T {
  return JSON.parse(body) as T;
}
