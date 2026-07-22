import { Buffer } from "node:buffer";

import { Inject, Injectable } from "@nestjs/common";

import { dailyLeaderboardPageSchema } from "@skymenders/protocol";
import type {
  DailyLeaderboardMe,
  DailyLeaderboardPage,
  LeaderboardEntry,
} from "@skymenders/protocol";

import { GAME_REPOSITORY, LEADERBOARD_CACHE } from "../core/contracts.js";
import type {
  GameRepository,
  LeaderboardCache,
  StoredLeaderboardEntry,
} from "../core/contracts.js";
import { ApiError } from "../http/api-error.js";
import { DailyChallengeService } from "./daily-challenge.service.js";

@Injectable()
export class LeaderboardService {
  public constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository,
    @Inject(LEADERBOARD_CACHE) private readonly cache: LeaderboardCache,
    @Inject(DailyChallengeService) private readonly challenges: DailyChallengeService,
  ) {}

  public async list(
    cursorInput: string | undefined,
    limitInput: string | undefined,
  ): Promise<DailyLeaderboardPage> {
    const challenge = await this.challenges.currentChallenge();
    const offset = decodeCursor(cursorInput);
    const limit = parseLimit(limitInput);
    const key = `daily-leaderboard:${challenge.challengeId}:${offset}:${limit}`;
    const cached = this.cachePage(await this.cache.get(key));
    if (cached !== null) return cached;
    const records = await this.repository.listLeaderboard(challenge.challengeId, offset, limit);
    const page: DailyLeaderboardPage = {
      challengeId: challenge.challengeId,
      entries: records.map((record, index) => publicEntry(record, offset + index + 1)),
      nextCursor: records.length < limit ? null : encodeCursor(offset + records.length),
    };
    await this.cache.set(key, page, 30);
    return page;
  }

  public async me(accountId: string): Promise<DailyLeaderboardMe> {
    const challenge = await this.challenges.currentChallenge();
    const result = await this.repository.getLeaderboardEntry(challenge.challengeId, accountId);
    return {
      challengeId: challenge.challengeId,
      entry: result === null ? null : publicEntry(result.entry, result.rank),
    };
  }

  private cachePage(value: unknown): DailyLeaderboardPage | null {
    if (value === null) return null;
    const parsed = dailyLeaderboardPageSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
}

function publicEntry(record: StoredLeaderboardEntry, rank: number): LeaderboardEntry {
  return {
    rank,
    systemCode: record.systemCode,
    avatarId: record.avatarId,
    score: record.score,
    completionMs: record.completionMs,
    turns: record.turns,
    completionStatus: record.completionStatus,
  };
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      typeof value !== "object" ||
      value === null ||
      !("offset" in value) ||
      !Number.isSafeInteger(value.offset) ||
      (value.offset as number) < 0
    )
      throw new Error("invalid cursor");
    return value.offset as number;
  } catch {
    throw new ApiError(400, "CURSOR_INVALID", "Leaderboard cursor is invalid");
  }
}

function parseLimit(input: string | undefined): number {
  if (input === undefined) return 50;
  const value = Number(input);
  if (!Number.isSafeInteger(value) || value < 1 || value > 100)
    throw new ApiError(400, "LIMIT_INVALID", "Leaderboard limit must be between 1 and 100");
  return value;
}
