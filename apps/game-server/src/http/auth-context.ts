import { Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { AccessTokenService } from "@skymenders/security";

import { GAME_REPOSITORY, SERVER_CLOCK } from "../core/contracts.js";
import type { GameRepository, ServerClock } from "../core/contracts.js";
import { ApiError } from "./api-error.js";

export interface AuthenticatedRequest extends FastifyRequest {
  auth?: { readonly accountId: string; readonly sessionId: string };
}

@Injectable()
export class AccessGuard implements CanActivate {
  public constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
    @Inject(AccessTokenService) private readonly tokens: AccessTokenService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (authorization?.startsWith("Bearer ") !== true)
      throw new ApiError(401, "AUTH_REQUIRED", "A bearer access token is required");
    let claims: Awaited<ReturnType<AccessTokenService["verify"]>>;
    try {
      claims = await this.tokens.verify(authorization.slice(7), this.clock.now());
    } catch {
      throw new ApiError(401, "ACCESS_TOKEN_INVALID", "The access token is invalid or expired");
    }
    const session = await this.repository.findSession(claims.sessionId);
    if (
      session?.accountId !== claims.accountId ||
      session.revokedAt !== null ||
      session.expiresAt <= this.clock.now()
    )
      throw new ApiError(401, "SESSION_REVOKED", "The session is no longer active");
    request.auth = claims;
    return true;
  }
}

export function auth(request: AuthenticatedRequest): NonNullable<AuthenticatedRequest["auth"]> {
  if (request.auth === undefined)
    throw new ApiError(401, "AUTH_REQUIRED", "Authentication required");
  return request.auth;
}
