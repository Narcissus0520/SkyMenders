import { Worker } from "bullmq";
import { Redis } from "ioredis";

import { REPLAY_VERIFICATION_QUEUE_NAME } from "@skymenders/game-server";
import { replayVerificationJobSchema } from "@skymenders/protocol";
import type { ReplayVerificationResult } from "@skymenders/protocol";

import type { ReplayVerificationProcessor } from "./replay-verification.processor.js";

export class ReplayWorkerRuntime {
  readonly #connection: Redis;
  readonly #worker: Worker<unknown, ReplayVerificationResult>;

  public constructor(
    redisUrl: string,
    processor: ReplayVerificationProcessor,
    concurrency: number,
  ) {
    this.#connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.#worker = new Worker(
      REPLAY_VERIFICATION_QUEUE_NAME,
      async (job) => processor.process(replayVerificationJobSchema.parse(job.data)),
      { connection: this.#connection, concurrency },
    );
  }

  public async ready(): Promise<void> {
    await this.#worker.waitUntilReady();
  }

  public async close(): Promise<void> {
    await this.#worker.close();
    this.#connection.disconnect();
  }
}
