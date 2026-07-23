import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";

import { GameServerModule } from "./app.module.js";
import type { GameServerModuleOptions } from "./app.module.js";
import { ApiExceptionFilter } from "./http/api-error.js";
import { RequestTelemetry, traceIdFromHeader } from "./observability/request-telemetry.js";

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
  const fastify = app.getHttpAdapter().getInstance();
  const startedAt = new WeakMap<FastifyRequest, bigint>();
  const telemetry = new RequestTelemetry(
    options.config.nodeEnv === "test"
      ? undefined
      : (record) => process.stdout.write(`${JSON.stringify(record)}\n`),
  );
  fastify.addHook("onRequest", (request, reply, done) => {
    startedAt.set(request, process.hrtime.bigint());
    telemetry.begin();
    void reply.header("x-request-id", request.id);
    done();
  });
  fastify.addHook("onResponse", (request, reply, done) => {
    const start = startedAt.get(request) ?? process.hrtime.bigint();
    telemetry.complete({
      requestId: request.id,
      traceId: traceIdFromHeader(request.headers.traceparent, request.id),
      method: request.method,
      route: request.routeOptions.url ?? "/unmatched",
      statusCode: reply.statusCode,
      durationMilliseconds: Number(process.hrtime.bigint() - start) / 1_000_000,
    });
    done();
  });
  fastify.get(
    "/metrics",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    (_request, reply) =>
      reply.type("text/plain; version=0.0.4; charset=utf-8").send(telemetry.prometheus()),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  const openApi = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("SkyMenders Game API")
      .setVersion("0.4.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs", app, openApi, { jsonDocumentUrl: "openapi.json" });
  await app.init();
  await fastify.ready();
  return app;
}
