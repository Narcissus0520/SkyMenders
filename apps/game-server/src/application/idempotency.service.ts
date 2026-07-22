import { Inject, Injectable } from "@nestjs/common";

import { GAME_REPOSITORY, SERVER_CLOCK } from "../core/contracts.js";
import type { GameRepository, ServerClock } from "../core/contracts.js";
import { ApiError } from "../http/api-error.js";

@Injectable()
export class IdempotencyService {
  public constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

  public async execute<T>(
    accountId: string,
    route: string,
    key: string | undefined,
    operation: () => Promise<{ readonly statusCode: number; readonly response: T }>,
  ): Promise<{ readonly statusCode: number; readonly response: T }> {
    if (key === undefined || !/^[A-Za-z0-9._:-]{8,128}$/.test(key))
      throw new ApiError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Idempotency-Key must contain 8 to 128 safe characters",
      );
    const now = this.clock.now();
    const cached = await this.repository.getIdempotency(accountId, route, key, now);
    if (cached !== null) return cached as { statusCode: number; response: T };
    const result = await operation();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
    await this.repository.putIdempotency(accountId, route, key, result, expiresAt);
    return result;
  }
}
