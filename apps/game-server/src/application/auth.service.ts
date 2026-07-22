import { Inject, Injectable } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";

import type { DeviceKind, SessionResponse } from "@skymenders/protocol";
import {
  AccessTokenService,
  derivePlatformSubject,
  hashRefreshToken,
  issueRefreshToken,
} from "@skymenders/security";

import {
  GAME_REPOSITORY,
  SERVER_CLOCK,
  SERVER_CONFIG,
  WECHAT_CODE_EXCHANGE,
} from "../core/contracts.js";
import type { GameRepository, ServerClock, WechatCodeExchange } from "../core/contracts.js";
import type { ServerConfig } from "../core/server-config.js";
import { ApiError } from "../http/api-error.js";

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

@Injectable()
export class AuthService {
  public constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository,
    @Inject(WECHAT_CODE_EXCHANGE) private readonly wechat: WechatCodeExchange,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
    @Inject(SERVER_CONFIG) private readonly config: ServerConfig,
    @Inject(AccessTokenService) private readonly accessTokens: AccessTokenService,
  ) {}

  public async login(code: string, deviceKind: DeviceKind): Promise<SessionResponse> {
    const platform = await this.wechat.exchange(code);
    const now = this.clock.now();
    const subjectHash = derivePlatformSubject(platform.openId, this.config.sessionPepper);
    const account = await this.repository.findOrCreateAccount("wechat", subjectHash, now);
    const refresh = issueRefreshToken(this.config.sessionPepper);
    const sessionId = uuidv7({ msecs: now.getTime() });
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS);
    await this.repository.createSession({
      id: sessionId,
      accountId: account.id,
      refreshTokenHash: refresh.hash,
      deviceKind,
      createdAt: now,
      expiresAt: refreshExpiresAt,
      revokedAt: null,
    });
    return this.sessionResponse(account.id, sessionId, refresh.token, refreshExpiresAt, now);
  }

  public async refresh(refreshToken: string): Promise<SessionResponse> {
    const now = this.clock.now();
    const hash = hashRefreshToken(refreshToken, this.config.sessionPepper);
    const session = await this.repository.findSessionByRefreshHash(hash);
    if (session?.revokedAt !== null || session.expiresAt <= now)
      throw new ApiError(401, "REFRESH_TOKEN_INVALID", "The refresh token is invalid or expired");
    const replacement = issueRefreshToken(this.config.sessionPepper);
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS);
    await this.repository.rotateSession(session.id, replacement.hash, refreshExpiresAt);
    return this.sessionResponse(
      session.accountId,
      session.id,
      replacement.token,
      refreshExpiresAt,
      now,
    );
  }

  public async logout(refreshToken: string): Promise<{ readonly revoked: true }> {
    let hash: string;
    try {
      hash = hashRefreshToken(refreshToken, this.config.sessionPepper);
    } catch {
      return { revoked: true };
    }
    await this.repository.revokeSessionByRefreshHash(hash, this.clock.now());
    return { revoked: true };
  }

  private async sessionResponse(
    accountId: string,
    sessionId: string,
    refreshToken: string,
    refreshExpiresAt: Date,
    now: Date,
  ): Promise<SessionResponse> {
    const access = await this.accessTokens.issue({ accountId, sessionId }, now);
    return {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshExpiresAt: refreshExpiresAt.toISOString(),
      accountId,
    };
  }
}
