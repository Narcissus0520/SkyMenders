import { Redis } from "ioredis";

import type { LeaderboardCache } from "../core/contracts.js";

export class RedisLeaderboardCache implements LeaderboardCache {
  readonly #redis: Redis;

  public constructor(redisUrl: string) {
    this.#redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  }

  public async get(key: string): Promise<unknown> {
    const value = await this.#redis.get(key);
    return value === null ? null : (JSON.parse(value) as unknown);
  }

  public async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.#redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  public async invalidateChallenge(challengeId: string): Promise<void> {
    let cursor = "0";
    do {
      const [next, keys] = await this.#redis.scan(
        cursor,
        "MATCH",
        `daily-leaderboard:${challengeId}:*`,
        "COUNT",
        100,
      );
      cursor = next;
      if (keys.length > 0) await this.#redis.del(...keys);
    } while (cursor !== "0");
  }

  public async close(): Promise<void> {
    this.#redis.disconnect();
    await Promise.resolve();
  }

  public async health(): Promise<void> {
    await this.#redis.ping();
  }
}

export class MemoryLeaderboardCache implements LeaderboardCache {
  readonly #entries = new Map<string, unknown>();

  public get(key: string): Promise<unknown> {
    return Promise.resolve(structuredClone(this.#entries.get(key) ?? null));
  }

  public set(key: string, value: unknown, _ttlSeconds: number): Promise<void> {
    this.#entries.set(key, structuredClone(value));
    return Promise.resolve();
  }

  public invalidateChallenge(challengeId: string): Promise<void> {
    for (const key of this.#entries.keys())
      if (key.startsWith(`daily-leaderboard:${challengeId}:`)) this.#entries.delete(key);
    return Promise.resolve();
  }

  public async close(): Promise<void> {
    this.#entries.clear();
    await Promise.resolve();
  }

  public health(): Promise<void> {
    return Promise.resolve();
  }
}
