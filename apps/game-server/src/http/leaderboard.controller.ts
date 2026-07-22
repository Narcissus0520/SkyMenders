import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { LeaderboardService } from "../application/leaderboard.service.js";
import { AccessGuard, auth } from "./auth-context.js";
import type { AuthenticatedRequest } from "./auth-context.js";

@ApiTags("leaderboards")
@Controller("v1/leaderboards/daily")
export class LeaderboardController {
  public constructor(
    @Inject(LeaderboardService) private readonly leaderboard: LeaderboardService,
  ) {}

  @Get()
  public async list(
    @Query("cursor") cursor: string | undefined,
    @Query("limit") limit: string | undefined,
  ) {
    return this.leaderboard.list(cursor, limit);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(AccessGuard)
  public async me(@Req() request: AuthenticatedRequest) {
    return this.leaderboard.me(auth(request).accountId);
  }
}
