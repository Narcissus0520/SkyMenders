import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { createContentGateway } from "../apps/content-gateway/dist/server.js";
import { ContentWorkspace } from "../apps/content-gateway/dist/workspace.js";
import type { ServerClock, WechatCodeExchange } from "../apps/game-server/dist/core/contracts.js";
import type { ServerConfig } from "../apps/game-server/dist/core/server-config.js";
import { loadChallengeContent } from "../apps/game-server/dist/infrastructure/challenge-runtime.js";
import { MemoryAdminRepository } from "../apps/game-server/dist/infrastructure/memory-admin.repository.js";
import { MemoryGameRepository } from "../apps/game-server/dist/infrastructure/memory.repository.js";
import { createGameServer } from "../apps/game-server/dist/server.js";

const repositoryRoot = resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(resolve(tmpdir(), "skymenders-e2e-"));
await cp(resolve(repositoryRoot, "content"), resolve(temporaryRoot, "content"), {
  recursive: true,
});

const config: ServerConfig = {
  nodeEnv: "test",
  port: 4_320,
  host: "127.0.0.1",
  databaseUrl: "postgresql://unused:unused@127.0.0.1:5432/unused",
  sessionPepper: "e2e-session-pepper-with-more-than-thirty-two-bytes",
  accessTokenSecret: "e2e-player-access-secret-with-more-than-thirty-two-bytes",
  wechatAppId: "e2e-app",
  wechatAppSecret: "e2e-server-only-secret",
  accessTokenIssuer: "skymenders-e2e",
  accessTokenAudience: "skymenders-e2e-client",
  redisUrl: "redis://127.0.0.1:6379",
  challengeSeedSecret: "e2e-challenge-seed-secret-with-more-than-thirty-two-bytes",
  dailyChallengeTimeZone: "Asia/Shanghai",
  adminBootstrapToken: "e2e-admin-bootstrap-token-with-more-than-thirty-two-bytes",
  adminAccessTokenSecret: "e2e-admin-access-secret-with-more-than-thirty-two-bytes",
  adminAccessTokenIssuer: "skymenders-e2e-admin",
  adminAccessTokenAudience: "skymenders-e2e-admin-console",
  contentSigningSecret: "e2e-content-signing-secret-with-more-than-thirty-two-bytes",
};
const clock: ServerClock = { now: () => new Date("2026-07-23T03:00:00.000Z") };
const wechat: WechatCodeExchange = {
  exchange: () => Promise.resolve({ openId: "e2e-private-id" }),
};
const gameServer = await createGameServer({
  repository: new MemoryGameRepository(),
  adminRepository: new MemoryAdminRepository(),
  wechatCodeExchange: wechat,
  config,
  clock,
  challengeContent: loadChallengeContent(resolve(repositoryRoot, "content")),
});
await gameServer.listen({ host: "127.0.0.1", port: 4_320 });

const gateway = await createContentGateway({
  workspace: new ContentWorkspace({ rootDirectory: temporaryRoot, now: () => clock.now() }),
  sessionToken: "e2e-content-session-token",
  signingSecret: "e2e-content-signing-secret-with-more-than-thirty-two-bytes",
});
await gateway.listen({ host: "127.0.0.1", port: 4_310 });

async function shutdown(): Promise<void> {
  await Promise.all([gateway.close(), gameServer.close()]);
  await rm(temporaryRoot, { recursive: true, force: true });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown().finally(() => process.exit(0));
  });
}
