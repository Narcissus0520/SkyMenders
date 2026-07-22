import "reflect-metadata";

import {
  loadChallengeContent,
  PrismaGameRepository,
  RedisLeaderboardCache,
} from "@skymenders/game-server";

import { loadWorkerConfig } from "./config.js";
import { WorkerHealthServer } from "./health-server.js";
import { ReplayVerificationProcessor } from "./replay-verification.processor.js";
import { ReplayWorkerRuntime } from "./worker-runtime.js";

const config = loadWorkerConfig();
const repository = new PrismaGameRepository(config.databaseUrl);
const cache = new RedisLeaderboardCache(config.redisUrl);
const processor = new ReplayVerificationProcessor(repository, loadChallengeContent(), cache);
const runtime = new ReplayWorkerRuntime(config.redisUrl, processor, config.concurrency);
const health = new WorkerHealthServer();
await health.listen(config.healthHost, config.healthPort);
await runtime.ready();
health.markReady();

let closing = false;
const close = async (): Promise<void> => {
  if (closing) return;
  closing = true;
  await health.close();
  await runtime.close();
  await cache.close();
  await repository.close();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
