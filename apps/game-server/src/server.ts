import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { GameServerModule } from "./app.module.js";
import type { GameServerModuleOptions } from "./app.module.js";
import { ApiExceptionFilter } from "./http/api-error.js";

export async function createGameServer(
  options: GameServerModuleOptions,
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    GameServerModule.register(options),
    new FastifyAdapter({ trustProxy: true, bodyLimit: 512 * 1_024 }),
    { bufferLogs: false, ...(options.config.nodeEnv === "test" ? { logger: false } : {}) },
  );
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  const openApi = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("SkyMenders Game API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs", app, openApi, { jsonDocumentUrl: "openapi.json" });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
