import { describe, expect, it } from "vitest";

import {
  AccessTokenService,
  derivePlatformSubject,
  hashRefreshToken,
  issueRefreshToken,
  refreshTokenMatches,
} from "../src/index.js";

const pepper = "test-pepper-with-at-least-thirty-two-bytes";

describe("pseudonymous platform identity", () => {
  it("uses stable keyed hashes without embedding the source identifier", () => {
    const openId = "wx-open-id-private-value";
    const subject = derivePlatformSubject(openId, pepper);
    expect(subject).toBe(derivePlatformSubject(openId, pepper));
    expect(subject).not.toContain(openId);
    expect(subject).toHaveLength(43);
  });

  it("rejects missing identifiers and weak peppers", () => {
    expect(() => derivePlatformSubject("", pepper)).toThrow("empty");
    expect(() => derivePlatformSubject("openid", "weak")).toThrow("at least 32 bytes");
  });
});

describe("refresh tokens", () => {
  it("returns an opaque token and a distinct server-only digest", () => {
    const issued = issueRefreshToken(pepper);
    expect(issued.token).toHaveLength(43);
    expect(issued.hash).toHaveLength(43);
    expect(issued.hash).not.toBe(issued.token);
    expect(refreshTokenMatches(issued.token, issued.hash, pepper)).toBe(true);
    expect(refreshTokenMatches(`${issued.token.slice(0, -1)}x`, issued.hash, pepper)).toBe(false);
  });

  it("rejects malformed inputs without leaking comparison behavior", () => {
    expect(() => hashRefreshToken("short", pepper)).toThrow("invalid length");
    expect(refreshTokenMatches("short", "invalid", pepper)).toBe(false);
  });
});

describe("short-lived access tokens", () => {
  it("round-trips only account and revocable session identifiers", async () => {
    const service = tokenService();
    const now = new Date("2026-07-22T08:00:00.000Z");
    const issued = await service.issue({ accountId: "account-1", sessionId: "session-1" }, now);
    expect(issued.expiresAt.toISOString()).toBe("2026-07-22T08:15:00.000Z");
    expect(await service.verify(issued.token, new Date("2026-07-22T08:14:59.000Z"))).toEqual({
      accountId: "account-1",
      sessionId: "session-1",
    });
    expect(issued.token).not.toContain("wx-open-id");
  });

  it("rejects expired tokens and invalid configuration", async () => {
    const service = tokenService();
    const issued = await service.issue(
      { accountId: "account-1", sessionId: "session-1" },
      new Date("2026-07-22T08:00:00.000Z"),
    );
    await expect(
      service.verify(issued.token, new Date("2026-07-22T08:15:01.000Z")),
    ).rejects.toThrow();
    expect(() => new AccessTokenService({ secret: "weak", issuer: "x", audience: "y" })).toThrow(
      "at least 32 bytes",
    );
    expect(
      () => new AccessTokenService({ secret: pepper, issuer: "x", audience: "y", ttlSeconds: 59 }),
    ).toThrow("between 60 and 3600");
  });
});

function tokenService(): AccessTokenService {
  return new AccessTokenService({
    secret: "test-access-secret-with-at-least-thirty-two-bytes",
    issuer: "skymenders-test",
    audience: "skymenders-client",
  });
}
