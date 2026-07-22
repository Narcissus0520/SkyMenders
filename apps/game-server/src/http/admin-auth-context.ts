import { Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { AccessTokenService } from "@skymenders/security";
import type { AdminRole } from "@skymenders/protocol";

import { ADMIN_ACCESS_TOKENS, ADMIN_REPOSITORY } from "../core/admin-contracts.js";
import type { AdminRepository } from "../core/admin-contracts.js";
import { SERVER_CLOCK } from "../core/contracts.js";
import type { ServerClock } from "../core/contracts.js";
import { ApiError } from "./api-error.js";

export interface AdminAuthenticatedRequest extends FastifyRequest {
  admin?: { readonly adminId: string; readonly sessionId: string; readonly role: AdminRole };
}

@Injectable()
export class AdminAccessGuard implements CanActivate {
  public constructor(
    @Inject(ADMIN_REPOSITORY) private readonly repository: AdminRepository,
    @Inject(ADMIN_ACCESS_TOKENS) private readonly tokens: AccessTokenService,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (authorization?.startsWith("Bearer ") !== true)
      throw new ApiError(401, "ADMIN_AUTH_REQUIRED", "A separate admin bearer token is required");
    let claims: Awaited<ReturnType<AccessTokenService["verify"]>>;
    try {
      claims = await this.tokens.verify(authorization.slice(7), this.clock.now());
    } catch {
      throw new ApiError(401, "ADMIN_TOKEN_INVALID", "The admin token is invalid or expired");
    }
    const [session, admin] = await Promise.all([
      this.repository.findSession(claims.sessionId),
      this.repository.findAdmin(claims.accountId),
    ]);
    const now = this.clock.now();
    if (
      session?.adminId !== claims.accountId ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      admin?.active !== true
    )
      throw new ApiError(401, "ADMIN_SESSION_REVOKED", "The admin session is no longer active");
    request.admin = { adminId: admin.id, sessionId: session.id, role: admin.role };
    return true;
  }
}

export function adminAuth(
  request: AdminAuthenticatedRequest,
): NonNullable<AdminAuthenticatedRequest["admin"]> {
  if (request.admin === undefined)
    throw new ApiError(401, "ADMIN_AUTH_REQUIRED", "Admin authentication required");
  return request.admin;
}
