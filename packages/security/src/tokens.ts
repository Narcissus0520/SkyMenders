import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

const MIN_SECRET_BYTES = 32;

export interface AccessTokenClaims {
  readonly accountId: string;
  readonly sessionId: string;
}

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface IssuedRefreshToken {
  readonly token: string;
  readonly hash: string;
}

export function derivePlatformSubject(openId: string, pepper: string): string {
  if (openId.length === 0) throw new Error("platform identifier is empty");
  assertSecret(pepper, "session pepper");
  return createHmac("sha256", pepper).update(openId, "utf8").digest("base64url");
}

export function issueRefreshToken(pepper: string): IssuedRefreshToken {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashRefreshToken(token, pepper) };
}

export function hashRefreshToken(token: string, pepper: string): string {
  if (token.length < 43 || token.length > 256) throw new Error("refresh token has invalid length");
  assertSecret(pepper, "session pepper");
  return createHmac("sha256", pepper).update(token, "utf8").digest("base64url");
}

export function refreshTokenMatches(token: string, expectedHash: string, pepper: string): boolean {
  let actual: Buffer;
  let expected: Buffer;
  try {
    actual = Buffer.from(hashRefreshToken(token, pepper), "base64url");
    expected = Buffer.from(expectedHash, "base64url");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class AccessTokenService {
  readonly #key: Uint8Array;
  readonly #issuer: string;
  readonly #audience: string;
  readonly #ttlSeconds: number;

  public constructor(input: {
    readonly secret: string;
    readonly issuer: string;
    readonly audience: string;
    readonly ttlSeconds?: number;
  }) {
    assertSecret(input.secret, "access token secret");
    if (input.issuer.length === 0 || input.audience.length === 0)
      throw new Error("access token issuer and audience are required");
    const ttlSeconds = input.ttlSeconds ?? 900;
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 3_600)
      throw new RangeError("access token ttl must be between 60 and 3600 seconds");
    this.#key = new TextEncoder().encode(input.secret);
    this.#issuer = input.issuer;
    this.#audience = input.audience;
    this.#ttlSeconds = ttlSeconds;
  }

  public async issue(claims: AccessTokenClaims, now = new Date()): Promise<IssuedAccessToken> {
    const issuedAt = Math.trunc(now.getTime() / 1_000);
    const expiresAt = new Date((issuedAt + this.#ttlSeconds) * 1_000);
    const token = await new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(claims.accountId)
      .setIssuer(this.#issuer)
      .setAudience(this.#audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.#ttlSeconds)
      .sign(this.#key);
    return { token, expiresAt };
  }

  public async verify(token: string, now = new Date()): Promise<AccessTokenClaims> {
    const result = await jwtVerify(token, this.#key, {
      algorithms: ["HS256"],
      issuer: this.#issuer,
      audience: this.#audience,
      currentDate: now,
    });
    if (typeof result.payload.sub !== "string" || typeof result.payload.sid !== "string")
      throw new Error("access token is missing required claims");
    return { accountId: result.payload.sub, sessionId: result.payload.sid };
  }
}

function assertSecret(secret: string, label: string): void {
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES)
    throw new Error(`${label} must be at least ${MIN_SECRET_BYTES} bytes`);
}
