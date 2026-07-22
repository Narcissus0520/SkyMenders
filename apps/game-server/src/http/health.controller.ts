import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import {
  GAME_REPOSITORY,
  LEADERBOARD_CACHE,
  REPLAY_VERIFICATION_QUEUE,
} from "../core/contracts.js";
import type {
  GameRepository,
  LeaderboardCache,
  ReplayVerificationQueue,
} from "../core/contracts.js";
import { ApiError } from "./api-error.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  public constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository,
    @Inject(REPLAY_VERIFICATION_QUEUE) private readonly queue: ReplayVerificationQueue,
    @Inject(LEADERBOARD_CACHE) private readonly cache: LeaderboardCache,
  ) {}

  @Get("live")
  public live() {
    return { status: "ok" };
  }

  @Get("ready")
  public async ready() {
    try {
      await Promise.all([this.repository.health(), this.queue.health(), this.cache.health()]);
      return { status: "ready" };
    } catch {
      throw new ApiError(503, "SERVICE_NOT_READY", "Service dependencies are not ready");
    }
  }
}
