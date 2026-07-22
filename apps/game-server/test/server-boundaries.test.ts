import { describe, expect, it } from "vitest";

import { createDailyChallenge } from "@skymenders/challenge-core";

import { loadServerConfig } from "../src/core/server-config.js";
import { loadChallengeContent } from "../src/infrastructure/challenge-runtime.js";
import { MemoryGameRepository } from "../src/infrastructure/memory.repository.js";
import { HttpWechatCodeExchange } from "../src/infrastructure/wechat-code-exchange.js";

describe("server configuration boundary", () => {
  it("loads required secrets only from the server environment", () => {
    expect(
      loadServerConfig({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/test",
        SESSION_PEPPER: "server-session-pepper-with-thirty-two-bytes",
        ACCESS_TOKEN_SECRET: "server-access-secret-with-thirty-two-bytes",
        WECHAT_APP_ID: "app-id",
        WECHAT_APP_SECRET: "app-secret",
        REDIS_URL: "redis://127.0.0.1:6379",
        CHALLENGE_SEED_SECRET: "challenge-seed-secret-with-thirty-two-bytes",
        ADMIN_BOOTSTRAP_TOKEN: "admin-bootstrap-token-with-more-than-thirty-two-bytes",
        ADMIN_ACCESS_TOKEN_SECRET: "admin-access-token-secret-with-more-than-thirty-two-bytes",
        CONTENT_SIGNING_SECRET: "content-signing-secret-with-more-than-thirty-two-bytes",
      }),
    ).toMatchObject({
      nodeEnv: "test",
      port: 3_000,
      host: "127.0.0.1",
      accessTokenIssuer: "skymenders-api",
      accessTokenAudience: "skymenders-client",
      adminAccessTokenAudience: "skymenders-admin-console",
      adminAccessTokenIssuer: "skymenders-admin-api",
    });
    expect(() => loadServerConfig({ NODE_ENV: "production" })).toThrow();
  });
});

describe("WeChat code exchange boundary", () => {
  it("parses a successful response without returning other platform fields", async () => {
    let requestedUrl = "";
    const exchange = new HttpWechatCodeExchange("app-id", "server-secret", (input) => {
      requestedUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve(
        new Response(JSON.stringify({ openid: "private-open-id", session_key: "not-returned" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    expect(await exchange.exchange("one-use-code")).toEqual({ openId: "private-open-id" });
    expect(requestedUrl).toContain("js_code=one-use-code");
    expect(requestedUrl).toContain("secret=server-secret");
  });

  it("maps platform rejection and network failure to stable public errors", async () => {
    const rejected = new HttpWechatCodeExchange("app-id", "server-secret", () =>
      Promise.resolve(
        new Response(JSON.stringify({ errcode: 40_029 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(rejected.exchange("bad-code")).rejects.toMatchObject({
      statusCode: 401,
      code: "WECHAT_CODE_INVALID",
    });
    const unavailable = new HttpWechatCodeExchange("app-id", "server-secret", () =>
      Promise.reject(new Error("offline")),
    );
    await expect(unavailable.exchange("code")).rejects.toMatchObject({
      statusCode: 503,
      code: "WECHAT_UNAVAILABLE",
    });
  });
});

describe("daily definition persistence boundary", () => {
  it("keeps the first definition frozen when a seed secret rotates during the business day", async () => {
    const repository = new MemoryGameRepository();
    const content = loadChallengeContent();
    const instant = new Date("2026-07-22T08:00:00.000Z");
    const common = {
      instant,
      timeZone: "Asia/Shanghai",
      rulesVersion: "0.5.0",
      contentVersion: "0.1.0",
    };
    const first = createDailyChallenge(content, {
      ...common,
      seedSecret: "first-daily-secret-with-at-least-thirty-two-bytes",
    });
    const rotated = createDailyChallenge(content, {
      ...common,
      seedSecret: "rotated-daily-secret-with-at-least-thirty-two-bytes",
    });
    expect(rotated.challengeId).not.toBe(first.challengeId);
    await repository.ensureDailyChallenge({
      id: first.challengeId,
      definition: first,
      createdAt: instant,
    });
    const frozen = await repository.ensureDailyChallenge({
      id: rotated.challengeId,
      definition: rotated,
      createdAt: instant,
    });
    expect(frozen.definition).toEqual(first);
  });
});
