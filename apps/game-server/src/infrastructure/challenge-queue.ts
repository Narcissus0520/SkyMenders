import { Queue } from "bullmq";
import { Redis } from "ioredis";

import type { ReplayVerificationQueue } from "../core/contracts.js";

export const REPLAY_VERIFICATION_QUEUE_NAME = "replay-verification";

export class BullMqReplayVerificationQueue implements ReplayVerificationQueue {
  readonly #connection: Redis;
  readonly #queue: Queue;

  public constructor(redisUrl: string) {
    this.#connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.#queue = new Queue(REPLAY_VERIFICATION_QUEUE_NAME, { connection: this.#connection });
  }

  public async enqueue(submissionId: string): Promise<void> {
    await this.#queue.add(
      "verify",
      { submissionId },
      {
        jobId: submissionId,
        attempts: 5,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
  }

  public async close(): Promise<void> {
    await this.#queue.close();
    this.#connection.disconnect();
  }

  public async health(): Promise<void> {
    await this.#queue.waitUntilReady();
  }
}

export class MemoryReplayVerificationQueue implements ReplayVerificationQueue {
  readonly #jobs: string[] = [];

  public get jobs(): readonly string[] {
    return [...this.#jobs];
  }

  public enqueue(submissionId: string): Promise<void> {
    if (!this.#jobs.includes(submissionId)) this.#jobs.push(submissionId);
    return Promise.resolve();
  }

  public async close(): Promise<void> {
    await Promise.resolve();
  }

  public health(): Promise<void> {
    return Promise.resolve();
  }
}
