import "reflect-metadata";

import { loadServerConfig } from "./core/server-config.js";
import { PrismaGameRepository } from "./infrastructure/prisma.repository.js";
import { HttpWechatCodeExchange } from "./infrastructure/wechat-code-exchange.js";
import { createGameServer } from "./server.js";

const config = loadServerConfig();
const repository = new PrismaGameRepository(config.databaseUrl);
const app = await createGameServer({
  config,
  repository,
  wechatCodeExchange: new HttpWechatCodeExchange(config.wechatAppId, config.wechatAppSecret),
});
await app.listen({ host: config.host, port: config.port });
