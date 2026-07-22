/* eslint-disable @typescript-eslint/require-await -- fake exchange conforms to an async boundary */
import "reflect-metadata";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createRngState, createSnapshot } from "@skymenders/deterministic-runtime";
import { DAILY_REPLAY_SCHEMA_VERSION, runtimeSnapshotSchema } from "@skymenders/protocol";
import type { ExpeditionSaveDocument, ExpeditionStateDocument } from "@skymenders/protocol";
import { sealExpeditionSave } from "@skymenders/save-migration";

import type { ServerClock, WechatCodeExchange } from "../src/core/contracts.js";
import type { ServerConfig } from "../src/core/server-config.js";
import { MemoryReplayVerificationQueue } from "../src/infrastructure/challenge-queue.js";
import { loadChallengeContent } from "../src/infrastructure/challenge-runtime.js";
import { MemoryGameRepository } from "../src/infrastructure/memory.repository.js";
import { createGameServer } from "../src/server.js";

class FixedClock implements ServerClock {
  public current = new Date("2026-07-22T08:00:00.000Z");
  public now(): Date {
    return new Date(this.current);
  }
}

class FakeWechat implements WechatCodeExchange {
  public async exchange(code: string): Promise<{ readonly openId: string }> {
    if (code === "rejected") throw new Error("fake upstream rejection");
    return { openId: `private-open-id:${code}` };
  }
}

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
  adminBootstrapToken: "integration-admin-bootstrap-token-with-thirty-two-bytes",
  adminAccessTokenSecret: "integration-admin-access-secret-with-thirty-two-bytes",
  adminAccessTokenIssuer: "skymenders-admin-api-test",
  adminAccessTokenAudience: "skymenders-admin-console-test",
  contentSigningSecret: "integration-content-signing-secret-with-thirty-two-bytes",
};

describe("game server HTTP contract", () => {
  let app: NestFastifyApplication;
  let server: FastifyInstance;
  let clock: FixedClock;
  let repository: MemoryGameRepository;
  let replayQueue: MemoryReplayVerificationQueue;

  beforeEach(async () => {
    clock = new FixedClock();
    repository = new MemoryGameRepository();
    replayQueue = new MemoryReplayVerificationQueue();
    app = await createGameServer({
      config,
      repository,
      wechatCodeExchange: new FakeWechat(),
      clock,
      challengeContent: loadChallengeContent(),
      replayVerificationQueue: replayQueue,
    });
    server = app.getHttpAdapter().getInstance();
  });

  afterEach(async () => {
    await app.close();
  });

  it("publishes liveness and OpenAPI documents", async () => {
    expect(await json(server, { method: "GET", url: "/health/live" })).toMatchObject({
      statusCode: 200,
      body: { status: "ok" },
    });
    expect(await json(server, { method: "GET", url: "/health/ready" })).toMatchObject({
      statusCode: 200,
      body: { status: "ready" },
    });
    const openApi = await json(server, { method: "GET", url: "/openapi.json" });
    expect(openApi.statusCode).toBe(200);
    expect(openApi.body).toMatchObject({ info: { title: "SkyMenders Game API" } });
    const paths = (openApi.body as { paths: Record<string, Record<string, unknown>> }).paths;
    const loginOperation = paths["/v1/auth/wechat"]?.post as { requestBody?: unknown } | undefined;
    const saveOperation = paths["/v1/saves/expedition"]?.put as
      { requestBody?: unknown; security?: unknown } | undefined;
    const conflictOperation = paths["/v1/saves/resolve-conflict"]?.post as
      { requestBody?: unknown } | undefined;
    expect(loginOperation?.requestBody).toBeDefined();
    expect(saveOperation?.requestBody).toBeDefined();
    expect(Array.isArray(saveOperation?.security)).toBe(true);
    expect(conflictOperation?.requestBody).toBeDefined();
  });

  it("returns stable validation, authorization, upstream, and routing errors", async () => {
    expect(
      await json(server, { method: "POST", url: "/v1/auth/wechat", payload: {} }),
    ).toMatchObject({ statusCode: 400, body: { error: { code: "INVALID_REQUEST" } } });
    expect(await json(server, { method: "GET", url: "/v1/profile" })).toMatchObject({
      statusCode: 401,
      body: { error: { code: "AUTH_REQUIRED" } },
    });
    expect(
      await json(server, {
        method: "GET",
        url: "/v1/profile",
        headers: { authorization: "Bearer not-a-token" },
      }),
    ).toMatchObject({ statusCode: 401, body: { error: { code: "ACCESS_TOKEN_INVALID" } } });
    expect(
      await json(server, {
        method: "POST",
        url: "/v1/auth/refresh",
        payload: { refreshToken: "short" },
      }),
    ).toMatchObject({ statusCode: 400, body: { error: { code: "INVALID_REQUEST" } } });
    expect(
      await json(server, {
        method: "POST",
        url: "/v1/auth/wechat",
        payload: { code: "rejected", deviceKind: "wechat" },
      }),
    ).toMatchObject({ statusCode: 500, body: { error: { code: "INTERNAL_ERROR" } } });
    expect(await json(server, { method: "GET", url: "/does-not-exist" })).toMatchObject({
      statusCode: 404,
      body: { error: { code: "HTTP_ERROR" } },
    });
  });

  it("exchanges a WeChat code without exposing OpenID and rotates revocable sessions", async () => {
    const session = await login(server, "device-a");
    expect(JSON.stringify(session)).not.toContain("private-open-id");
    expect(typeof session.accountId).toBe("string");
    expect(typeof session.refreshToken).toBe("string");
    const repeatedLogin = await login(server, "device-a");
    expect(repeatedLogin.accountId).toBe(session.accountId);

    const profile = await authorized(server, session.accessToken, {
      method: "GET",
      url: "/v1/profile",
    });
    expect(profile.statusCode).toBe(200);
    expect(typeof (profile.body as { systemCode: unknown }).systemCode).toBe("string");

    const rotated = await json(server, {
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken: session.refreshToken },
    });
    expect(rotated.statusCode).toBe(200);
    expect((rotated.body as SessionBody).refreshToken).not.toBe(session.refreshToken);
    expect(
      await json(server, {
        method: "POST",
        url: "/v1/auth/refresh",
        payload: { refreshToken: session.refreshToken },
      }),
    ).toMatchObject({ statusCode: 401, body: { error: { code: "REFRESH_TOKEN_INVALID" } } });

    const active = rotated.body as SessionBody;
    expect(
      await json(server, {
        method: "POST",
        url: "/v1/auth/logout",
        payload: { refreshToken: active.refreshToken },
      }),
    ).toMatchObject({ statusCode: 200, body: { revoked: true } });
    expect(
      await authorized(server, active.accessToken, { method: "GET", url: "/v1/profile" }),
    ).toMatchObject({ statusCode: 401, body: { error: { code: "SESSION_REVOKED" } } });
  });

  it("expires short-lived access tokens independently of refresh sessions", async () => {
    const session = await login(server, "expiry-device");
    clock.current = new Date("2026-07-22T08:16:00.000Z");
    expect(
      await authorized(server, session.accessToken, { method: "GET", url: "/v1/profile" }),
    ).toMatchObject({ statusCode: 401, body: { error: { code: "ACCESS_TOKEN_INVALID" } } });
  });

  it("validates profile writes and replays them by idempotency key", async () => {
    const session = await login(server, "profile-device");
    const first = await authorized(server, session.accessToken, {
      method: "PATCH",
      url: "/v1/profile",
      headers: { "idempotency-key": "profile-update-0001" },
      payload: { highContrast: true },
    });
    expect(first).toMatchObject({ statusCode: 200, body: { settings: { highContrast: true } } });
    const replay = await authorized(server, session.accessToken, {
      method: "PATCH",
      url: "/v1/profile",
      headers: { "idempotency-key": "profile-update-0001" },
      payload: { highContrast: false },
    });
    expect(replay.body).toEqual(first.body);
    expect(
      await authorized(server, session.accessToken, {
        method: "PATCH",
        url: "/v1/profile",
        payload: { highContrast: false },
      }),
    ).toMatchObject({ statusCode: 400, body: { error: { code: "IDEMPOTENCY_KEY_REQUIRED" } } });
    expect(
      await authorized(server, session.accessToken, {
        method: "PATCH",
        url: "/v1/profile",
        headers: { "idempotency-key": "profile-update-0002" },
        payload: { unknownSetting: true },
      }),
    ).toMatchObject({ statusCode: 400, body: { error: { code: "INVALID_REQUEST" } } });
    const unlocks = await authorized(server, session.accessToken, {
      method: "GET",
      url: "/v1/profile/unlocks",
    });
    expect(unlocks.statusCode).toBe(200);
    expect((unlocks.body as { unlockIds: string[] }).unlockIds).toContain("robot_rivet");
    expect(
      await authorized(server, session.accessToken, {
        method: "GET",
        url: "/v1/profile/achievements",
      }),
    ).toMatchObject({ statusCode: 200, body: { achievementIds: [] } });
  });

  it("detects expedition branches and returns summaries instead of save JSON", async () => {
    const session = await login(server, "save-device");
    expect(
      await authorized(server, session.accessToken, { method: "GET", url: "/v1/saves/expedition" }),
    ).toMatchObject({ statusCode: 200, body: { document: null } });
    expect(
      await authorized(server, session.accessToken, {
        method: "POST",
        url: "/v1/saves/resolve-conflict",
        headers: { "idempotency-key": "save-resolve-empty" },
        payload: { choice: "cloud", expectedCloudRevision: 0, localDocument: null },
      }),
    ).toMatchObject({ statusCode: 404, body: { error: { code: "CLOUD_SAVE_NOT_FOUND" } } });
    const local = makeSave();
    const first = await authorized(server, session.accessToken, {
      method: "PUT",
      url: "/v1/saves/expedition",
      headers: { "idempotency-key": "save-upload-0001" },
      payload: { baseRevision: null, document: local },
    });
    expect(first).toMatchObject({ statusCode: 200, body: { revision: 0, logicalClock: 1 } });

    const conflict = await authorized(server, session.accessToken, {
      method: "PUT",
      url: "/v1/saves/expedition",
      headers: { "idempotency-key": "save-upload-0002" },
      payload: { baseRevision: null, document: local },
    });
    expect(conflict).toMatchObject({
      statusCode: 409,
      body: { error: { code: "SAVE_CONFLICT", details: { cloud: { revision: 0 } } } },
    });
    expect(JSON.stringify((conflict.body as ErrorBody).error.details)).not.toContain("expedition");

    const resolved = await authorized(server, session.accessToken, {
      method: "POST",
      url: "/v1/saves/resolve-conflict",
      headers: { "idempotency-key": "save-resolve-0001" },
      payload: { choice: "cloud", expectedCloudRevision: 0, localDocument: null },
    });
    expect(resolved).toMatchObject({ statusCode: 200, body: { revision: 0 } });

    expect(
      await authorized(server, session.accessToken, {
        method: "POST",
        url: "/v1/saves/resolve-conflict",
        headers: { "idempotency-key": "save-resolve-stale" },
        payload: { choice: "local", expectedCloudRevision: 99, localDocument: makeSave(4) },
      }),
    ).toMatchObject({ statusCode: 409, body: { error: { code: "SAVE_CONFLICT" } } });
    const selectedLocal = await authorized(server, session.accessToken, {
      method: "POST",
      url: "/v1/saves/resolve-conflict",
      headers: { "idempotency-key": "save-resolve-local" },
      payload: { choice: "local", expectedCloudRevision: 0, localDocument: makeSave(4) },
    });
    expect(selectedLocal).toMatchObject({ statusCode: 200, body: { revision: 1 } });

    const concurrent = await Promise.all([
      authorized(server, session.accessToken, {
        method: "PUT",
        url: "/v1/saves/expedition",
        headers: { "idempotency-key": "save-concurrent-0001" },
        payload: { baseRevision: 1, document: makeSave(5) },
      }),
      authorized(server, session.accessToken, {
        method: "PUT",
        url: "/v1/saves/expedition",
        headers: { "idempotency-key": "save-concurrent-0002" },
        payload: { baseRevision: 1, document: makeSave(6) },
      }),
    ]);
    expect(concurrent.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const afterRace = await authorized(server, session.accessToken, {
      method: "GET",
      url: "/v1/saves/expedition",
    });
    expect(afterRace).toMatchObject({ statusCode: 200, body: { document: { revision: 2 } } });
    expect(
      await authorized(server, session.accessToken, {
        method: "DELETE",
        url: "/v1/saves/expedition",
        headers: { "idempotency-key": "save-delete-0001" },
      }),
    ).toMatchObject({ statusCode: 200, body: { deleted: true } });
    expect(
      await authorized(server, session.accessToken, {
        method: "DELETE",
        url: "/v1/saves/expedition",
        headers: { "idempotency-key": "save-delete-0002" },
      }),
    ).toMatchObject({ statusCode: 200, body: { deleted: true } });
  });

  it("merges account progress monotonically", async () => {
    const session = await login(server, "progress-device");
    const current = await authorized(server, session.accessToken, {
      method: "GET",
      url: "/v1/saves/progress",
    });
    const incoming = {
      ...(current.body as Record<string, unknown>),
      logicalClock: 2,
      updatedAt: "2026-07-22T08:01:00.000Z",
      unlockIds: ["robot_prism"],
      statistics: { expeditions_started: 2 },
    };
    const merged = await authorized(server, session.accessToken, {
      method: "PUT",
      url: "/v1/saves/progress",
      headers: { "idempotency-key": "progress-merge-0001" },
      payload: incoming,
    });
    expect(merged).toMatchObject({
      statusCode: 200,
      body: {
        logicalClock: 3,
        unlockIds: ["robot_anchor", "robot_gale", "robot_prism", "robot_rivet"],
        statistics: { expeditions_started: 2 },
      },
    });
  });

  it("owns the daily date, atomically limits formal starts, and queues strict replays", async () => {
    const session = await login(server, "daily-device");
    const daily = await authorized(server, session.accessToken, {
      method: "GET",
      url: "/v1/challenges/daily",
    });
    expect(daily).toMatchObject({
      statusCode: 200,
      body: {
        challenge: { businessDate: "2026-07-22" },
        formalAttemptsRemaining: 3,
        formalUnlocked: false,
      },
    });
    expect(
      await authorized(server, session.accessToken, {
        method: "POST",
        url: "/v1/challenges/daily/attempts/start",
        headers: { "idempotency-key": "daily-locked-0001" },
      }),
    ).toMatchObject({ statusCode: 403, body: { error: { code: "FORMAL_CHALLENGE_LOCKED" } } });

    const progress = await authorized(server, session.accessToken, {
      method: "GET",
      url: "/v1/saves/progress",
    });
    await authorized(server, session.accessToken, {
      method: "PUT",
      url: "/v1/saves/progress",
      headers: { "idempotency-key": "daily-unlock-0001" },
      payload: {
        ...(progress.body as Record<string, unknown>),
        logicalClock: 1,
        updatedAt: "2026-07-22T08:00:01.000Z",
        statistics: { standard_regions_completed: 1 },
      },
    });

    const starts = await Promise.all(
      [1, 2, 3, 4].map((index) =>
        authorized(server, session.accessToken, {
          method: "POST",
          url: "/v1/challenges/daily/attempts/start",
          headers: { "idempotency-key": `daily-start-000${index}` },
          payload: { businessDate: "2099-01-01" },
        }),
      ),
    );
    expect(starts.map((response) => response.statusCode).sort()).toEqual([200, 200, 200, 409]);
    const formal = starts.find((response) => response.statusCode === 200);
    if (formal === undefined) throw new Error("formal attempt was not created");
    const formalBody = formal.body as {
      attemptId: string;
      challenge: {
        challengeId: string;
        seed: number;
        rulesVersion: string;
        contentVersion: string;
        businessDate: string;
      };
    };
    expect(formalBody.challenge.businessDate).toBe("2026-07-22");
    const replayedStart = await authorized(server, session.accessToken, {
      method: "POST",
      url: "/v1/challenges/daily/attempts/start",
      headers: { "idempotency-key": "daily-start-0001" },
    });
    expect(replayedStart.body).toEqual(starts[0]?.body);

    for (const index of [1, 2, 3, 4]) {
      expect(
        await authorized(server, session.accessToken, {
          method: "POST",
          url: "/v1/challenges/daily/practice/start",
          headers: { "idempotency-key": `daily-practice-${index}` },
        }),
      ).toMatchObject({ statusCode: 200, body: { mode: "practice" } });
    }

    const checkpoint = await authorized(server, session.accessToken, {
      method: "PUT",
      url: `/v1/challenges/daily/attempts/${formalBody.attemptId}/checkpoint`,
      headers: { "idempotency-key": "daily-checkpoint-0001" },
      payload: {
        checkpointIndex: 1,
        commandCount: 2,
        stateHash: "0123456789abcdef",
        recoveryCount: 0,
        payload: { nodeId: "route-node" },
      },
    });
    expect(checkpoint).toMatchObject({ statusCode: 200, body: { checkpointIndex: 1 } });

    const submissionId = crypto.randomUUID();
    const finish = await authorized(server, session.accessToken, {
      method: "POST",
      url: `/v1/challenges/daily/attempts/${formalBody.attemptId}/finish`,
      headers: { "idempotency-key": "daily-finish-0001" },
      payload: {
        submissionId,
        challengeId: formalBody.challenge.challengeId,
        seed: formalBody.challenge.seed,
        rulesVersion: formalBody.challenge.rulesVersion,
        contentVersion: formalBody.challenge.contentVersion,
        replaySchemaVersion: DAILY_REPLAY_SCHEMA_VERSION,
        clientVersion: "0.4.0",
        claimedScore: 999_999,
        completionMs: 1,
        recoveryCount: 0,
        completionStatus: "completed",
        completedNodeIds: [],
        nodeReplays: [],
      },
    });
    expect(finish).toMatchObject({
      statusCode: 200,
      body: { submissionId, status: "queued" },
    });
    expect(replayQueue.jobs).toEqual([submissionId]);
    expect(
      await repository.getLeaderboardEntry(formalBody.challenge.challengeId, session.accountId),
    ).toBeNull();

    const leaderboard = await json(server, { method: "GET", url: "/v1/leaderboards/daily" });
    expect(leaderboard).toMatchObject({ statusCode: 200, body: { entries: [] } });
    expect(JSON.stringify(leaderboard.body)).not.toMatch(/openId|unionId|wechat|nickname/i);
  });

  it("paginates and caches only verified anonymous leaderboard projections", async () => {
    const session = await login(server, "leaderboard-device");
    const daily = await authorized(server, session.accessToken, {
      method: "GET",
      url: "/v1/challenges/daily",
    });
    const challenge = (
      daily.body as {
        challenge: {
          challengeId: string;
          seed: number;
          rulesVersion: string;
          contentVersion: string;
        };
      }
    ).challenge;
    const attemptId = crypto.randomUUID();
    await repository.createFormalAttempt({
      id: attemptId,
      accountId: session.accountId,
      challengeId: challenge.challengeId,
      mode: "formal",
      formalSlot: 1,
      status: "active",
      checkpointIndex: null,
      checkpoint: null,
      startedAt: clock.now(),
      updatedAt: clock.now(),
      completedAt: null,
    });
    const submissionId = crypto.randomUUID();
    await repository.submitDailyAttempt(
      session.accountId,
      attemptId,
      {
        submissionId,
        challengeId: challenge.challengeId,
        seed: challenge.seed,
        rulesVersion: challenge.rulesVersion,
        contentVersion: challenge.contentVersion,
        replaySchemaVersion: DAILY_REPLAY_SCHEMA_VERSION,
        clientVersion: "0.4.0",
        claimedScore: 90_000,
        completionMs: 180_000,
        recoveryCount: 0,
        completionStatus: "completed",
        completedNodeIds: [],
        nodeReplays: [],
      },
      clock.now(),
    );
    await repository.completeReplaySubmission(
      submissionId,
      {
        submissionId,
        status: "verified",
        score: 90_000,
        totalTurns: 9,
        rejectionCode: null,
      },
      clock.now(),
    );

    const first = await json(server, {
      method: "GET",
      url: "/v1/leaderboards/daily?limit=1",
    });
    expect(first).toMatchObject({
      statusCode: 200,
      body: {
        challengeId: challenge.challengeId,
        entries: [
          {
            rank: 1,
            score: 90_000,
            completionMs: 180_000,
            turns: 9,
            completionStatus: "completed",
          },
        ],
      },
    });
    expect(JSON.stringify(first.body)).not.toMatch(/accountId|openId|unionId|wechat|nickname/i);
    expect(await json(server, { method: "GET", url: "/v1/leaderboards/daily?limit=1" })).toEqual(
      first,
    );
    const nextCursor = (first.body as { nextCursor: string }).nextCursor;
    expect(
      await json(server, {
        method: "GET",
        url: `/v1/leaderboards/daily?limit=1&cursor=${encodeURIComponent(nextCursor)}`,
      }),
    ).toMatchObject({ statusCode: 200, body: { entries: [], nextCursor: null } });
    expect(
      await authorized(server, session.accessToken, {
        method: "GET",
        url: "/v1/leaderboards/daily/me",
      }),
    ).toMatchObject({ statusCode: 200, body: { entry: { rank: 1, score: 90_000 } } });
    expect(
      await json(server, { method: "GET", url: "/v1/leaderboards/daily?limit=0" }),
    ).toMatchObject({ statusCode: 400, body: { error: { code: "LIMIT_INVALID" } } });
    expect(
      await json(server, { method: "GET", url: "/v1/leaderboards/daily?cursor=not-a-cursor" }),
    ).toMatchObject({ statusCode: 400, body: { error: { code: "CURSOR_INVALID" } } });
  });

  it("exports only pseudonymous account data and hard-deletes the account", async () => {
    const session = await login(server, "privacy-device");
    const exported = await authorized(server, session.accessToken, {
      method: "POST",
      url: "/v1/privacy/export",
      headers: { "idempotency-key": "privacy-export-0001" },
    });
    expect(exported).toMatchObject({
      statusCode: 200,
      body: { request: { status: "completed" }, data: { account: { id: session.accountId } } },
    });
    expect(JSON.stringify(exported.body)).not.toContain("refreshTokenHash");
    expect(JSON.stringify(exported.body)).not.toContain("private-open-id");
    const exportRequestId = (exported.body as { request: { requestId: string } }).request.requestId;
    expect(
      await authorized(server, session.accessToken, {
        method: "GET",
        url: `/v1/privacy/requests/${exportRequestId}`,
      }),
    ).toMatchObject({ statusCode: 200, body: { status: "completed" } });
    expect(
      await authorized(server, session.accessToken, {
        method: "GET",
        url: "/v1/privacy/requests/018f0f40-7b1a-7000-8000-000000000099",
      }),
    ).toMatchObject({
      statusCode: 404,
      body: { error: { code: "PRIVACY_REQUEST_NOT_FOUND" } },
    });
    expect(
      await authorized(server, session.accessToken, {
        method: "DELETE",
        url: "/v1/privacy/account",
        payload: { confirmation: "NO" },
      }),
    ).toMatchObject({ statusCode: 400, body: { error: { code: "INVALID_REQUEST" } } });

    const deleted = await authorized(server, session.accessToken, {
      method: "DELETE",
      url: "/v1/privacy/account",
      payload: { confirmation: "DELETE_ACCOUNT" },
    });
    expect(deleted).toMatchObject({
      statusCode: 200,
      body: { kind: "delete", status: "completed" },
    });
    expect(
      await authorized(server, session.accessToken, { method: "GET", url: "/v1/profile" }),
    ).toMatchObject({ statusCode: 401 });
  });
});

interface SessionBody {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accountId: string;
}

interface ErrorBody {
  readonly error: { readonly details: unknown };
}

async function login(server: FastifyInstance, code: string): Promise<SessionBody> {
  const response = await json(server, {
    method: "POST",
    url: "/v1/auth/wechat",
    payload: { code, deviceKind: "wechat" },
  });
  expect(response.statusCode, JSON.stringify(response.body)).toBe(200);
  return response.body as SessionBody;
}

async function authorized(
  server: FastifyInstance,
  accessToken: string,
  options: InjectOptions,
): Promise<{ readonly statusCode: number; readonly body: unknown }> {
  const headers = { ...options.headers, authorization: `Bearer ${accessToken}` };
  return json(server, { ...options, headers });
}

async function json(
  server: FastifyInstance,
  options: InjectOptions,
): Promise<{ readonly statusCode: number; readonly body: unknown }> {
  const response: LightMyRequestResponse = await server.inject(options);
  return { statusCode: response.statusCode, body: response.json() };
}

function makeSave(logicalClock = 0): ExpeditionSaveDocument {
  const expedition = makeExpedition();
  return sealExpeditionSave({
    saveSchemaVersion: "0.1.0",
    saveId: "018f0f40-7b1a-7000-8000-000000000001",
    revision: 0,
    logicalClock,
    deviceKind: "wechat",
    updatedAt: `2026-07-22T08:00:0${logicalClock}.000Z`,
    contentVersion: "0.1.0",
    rulesVersion: "0.5.0",
    expedition,
    nodeStartSnapshot: snapshot("player_planning", 0),
    battleTurnSnapshot: snapshot("player_action", logicalClock),
    summary: {
      regionIndex: 1,
      layer: 0,
      completedNodes: 0,
      squadRobotIds: ["robot_rivet", "robot_anchor", "robot_gale"],
    },
  });
}

function snapshot(phase: string, turn: number) {
  return runtimeSnapshotSchema.parse(
    createSnapshot({
      rulesVersion: "0.5.0",
      contentVersion: "0.1.0",
      replaySchemaVersion: "0.1.0",
      turnIndex: turn,
      commandIndex: turn * 3,
      rngStates: { map: createRngState(42) },
      state: { phase, turn },
    }),
  );
}

function makeExpedition(): ExpeditionStateDocument {
  return {
    plan: {
      schemaVersion: "0.1.0",
      contentVersion: "0.1.0",
      rulesVersion: "0.5.0",
      seed: 42,
      regions: [1, 2, 3, 4].map((regionIndex) => ({
        id: `region_${regionIndex}`,
        regionIndex,
        layers: [
          [node(regionIndex, 0, 0), node(regionIndex, 0, 1)],
          [node(regionIndex, 1, 0), node(regionIndex, 1, 1)],
          [node(regionIndex, 2, 0, "boss")],
        ],
      })),
    },
    status: "active",
    regionIndex: 1,
    layer: 0,
    completedNodeIds: [],
    robots: ["robot_rivet", "robot_anchor", "robot_gale"].map((robotId) => ({
      robotId,
      hp: 100,
      maxHp: 100,
      structuralDamage: 0,
      disabled: false,
    })),
    researchEarned: 0,
    supplies: 0,
    routeRevealDepth: 1,
    inventory: {
      moduleIds: ["main_fold_bridge"],
      upgradeRouteIds: [],
      temporaryModIds: [],
      consumables: 0,
    },
    restartUsedNodeIds: [],
  };
}

function node(regionIndex: number, layer: 0 | 1 | 2, index: number, type = "battle") {
  return {
    id: `region_${regionIndex}_layer_${layer}_node_${index}`,
    regionIndex,
    layer,
    type: type as "battle" | "boss",
    mapId: `map_region_${regionIndex}_${index}`,
    eventId: null,
    bossId: type === "boss" ? `boss_${regionIndex}` : null,
    risk: Math.min(3, regionIndex) as 1 | 2 | 3,
    nextNodeIds: [],
  };
}
