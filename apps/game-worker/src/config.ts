import { z } from "zod";

const workerConfigSchema = z
  .object({
    databaseUrl: z.string().min(1),
    redisUrl: z.string().min(1),
    concurrency: z.number().int().min(1).max(32),
    healthHost: z.string().min(1),
    healthPort: z.number().int().min(1).max(65_535),
  })
  .strict();

export type WorkerConfig = z.infer<typeof workerConfigSchema>;

export function loadWorkerConfig(environment: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return workerConfigSchema.parse({
    databaseUrl: environment.DATABASE_URL,
    redisUrl: environment.REDIS_URL,
    concurrency: Number(environment.REPLAY_WORKER_CONCURRENCY ?? 2),
    healthHost: environment.WORKER_HEALTH_HOST ?? "127.0.0.1",
    healthPort: Number(environment.WORKER_HEALTH_PORT ?? 3_002),
  });
}
