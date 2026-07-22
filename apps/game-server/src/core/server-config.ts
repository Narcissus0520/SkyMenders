import { z } from "zod";

const serverConfigSchema = z
  .object({
    nodeEnv: z.enum(["development", "test", "production"]),
    port: z.number().int().min(1).max(65_535),
    host: z.string().min(1),
    databaseUrl: z.string().min(1),
    sessionPepper: z.string().min(32),
    accessTokenSecret: z.string().min(32),
    wechatAppId: z.string().min(1),
    wechatAppSecret: z.string().min(1),
    accessTokenIssuer: z.string().min(1),
    accessTokenAudience: z.string().min(1),
    redisUrl: z.string().min(1),
    challengeSeedSecret: z.string().min(32),
    dailyChallengeTimeZone: z.string().min(1),
    adminBootstrapToken: z.string().min(32),
    adminAccessTokenSecret: z.string().min(32),
    adminAccessTokenIssuer: z.string().min(1),
    adminAccessTokenAudience: z.string().min(1),
    contentSigningSecret: z.string().min(32),
  })
  .strict();

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  return serverConfigSchema.parse({
    nodeEnv: environment.NODE_ENV ?? "development",
    port: Number(environment.PORT ?? 3_000),
    host: environment.HOST ?? "127.0.0.1",
    databaseUrl: environment.DATABASE_URL,
    sessionPepper: environment.SESSION_PEPPER,
    accessTokenSecret: environment.ACCESS_TOKEN_SECRET,
    wechatAppId: environment.WECHAT_APP_ID,
    wechatAppSecret: environment.WECHAT_APP_SECRET,
    accessTokenIssuer: environment.ACCESS_TOKEN_ISSUER ?? "skymenders-api",
    accessTokenAudience: environment.ACCESS_TOKEN_AUDIENCE ?? "skymenders-client",
    redisUrl: environment.REDIS_URL,
    challengeSeedSecret: environment.CHALLENGE_SEED_SECRET,
    dailyChallengeTimeZone: environment.DAILY_CHALLENGE_TIME_ZONE ?? "Asia/Shanghai",
    adminBootstrapToken: environment.ADMIN_BOOTSTRAP_TOKEN,
    adminAccessTokenSecret: environment.ADMIN_ACCESS_TOKEN_SECRET,
    adminAccessTokenIssuer: environment.ADMIN_ACCESS_TOKEN_ISSUER ?? "skymenders-admin-api",
    adminAccessTokenAudience: environment.ADMIN_ACCESS_TOKEN_AUDIENCE ?? "skymenders-admin-console",
    contentSigningSecret: environment.CONTENT_SIGNING_SECRET,
  });
}
