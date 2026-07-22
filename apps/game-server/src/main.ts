import "reflect-metadata";

import { loadServerConfig } from "./core/server-config.js";
import { PrismaGameRepository } from "./infrastructure/prisma.repository.js";
import { PrismaAdminRepository } from "./infrastructure/prisma-admin.repository.js";
import { loadChallengeContent } from "./infrastructure/challenge-runtime.js";
import { BullMqReplayVerificationQueue } from "./infrastructure/challenge-queue.js";
import { RedisLeaderboardCache } from "./infrastructure/leaderboard-cache.js";
import { HttpWechatCodeExchange } from "./infrastructure/wechat-code-exchange.js";
import { createGameServer } from "./server.js";

const config = loadServerConfig();
const repository = new PrismaGameRepository(config.databaseUrl);
const app = await createGameServer({
  config,
  repository,
  adminRepository: new PrismaAdminRepository(config.databaseUrl),
  challengeContent: loadChallengeContent(),
  replayVerificationQueue: new BullMqReplayVerificationQueue(config.redisUrl),
  leaderboardCache: new RedisLeaderboardCache(config.redisUrl),
  wechatCodeExchange: new HttpWechatCodeExchange(config.wechatAppId, config.wechatAppSecret),
});
await app.listen({ host: config.host, port: config.port });
