import type { DynamicModule, OnApplicationShutdown } from "@nestjs/common";
import { Inject, Module } from "@nestjs/common";

import { AccessTokenService } from "@skymenders/security";
import type { PveContentPack } from "@skymenders/content-schema";

import { AuthService } from "./application/auth.service.js";
import { AdminService } from "./application/admin.service.js";
import { DailyChallengeService } from "./application/daily-challenge.service.js";
import { IdempotencyService } from "./application/idempotency.service.js";
import { LeaderboardService } from "./application/leaderboard.service.js";
import { PrivacyService } from "./application/privacy.service.js";
import { ProfileService } from "./application/profile.service.js";
import { SaveService } from "./application/save.service.js";
import {
  CHALLENGE_CONTENT,
  GAME_REPOSITORY,
  LEADERBOARD_CACHE,
  REPLAY_VERIFICATION_QUEUE,
  SERVER_CLOCK,
  SERVER_CONFIG,
  WECHAT_CODE_EXCHANGE,
} from "./core/contracts.js";
import type {
  GameRepository,
  LeaderboardCache,
  ReplayVerificationQueue,
  ServerClock,
  WechatCodeExchange,
} from "./core/contracts.js";
import type { ServerConfig } from "./core/server-config.js";
import { ADMIN_ACCESS_TOKENS, ADMIN_REPOSITORY, CONTENT_REGISTRY } from "./core/admin-contracts.js";
import type { AdminRepository } from "./core/admin-contracts.js";
import { AdminAccessGuard } from "./http/admin-auth-context.js";
import { AdminAuthController, AdminController } from "./http/admin.controller.js";
import { AccessGuard } from "./http/auth-context.js";
import { AuthController } from "./http/auth.controller.js";
import { DailyChallengeController } from "./http/daily-challenge.controller.js";
import { HealthController } from "./http/health.controller.js";
import { LeaderboardController } from "./http/leaderboard.controller.js";
import { PrivacyController } from "./http/privacy.controller.js";
import { ProfileController } from "./http/profile.controller.js";
import { SaveController } from "./http/save.controller.js";
import { ContentController } from "./http/content.controller.js";
import { MemoryLeaderboardCache } from "./infrastructure/leaderboard-cache.js";
import { MemoryReplayVerificationQueue } from "./infrastructure/challenge-queue.js";
import { ContentRegistry } from "./infrastructure/content-registry.js";
import { MemoryAdminRepository } from "./infrastructure/memory-admin.repository.js";

export interface GameServerModuleOptions {
  readonly repository: GameRepository;
  readonly wechatCodeExchange: WechatCodeExchange;
  readonly config: ServerConfig;
  readonly clock?: ServerClock;
  readonly challengeContent?: PveContentPack;
  readonly replayVerificationQueue?: ReplayVerificationQueue;
  readonly leaderboardCache?: LeaderboardCache;
  readonly adminRepository?: AdminRepository;
}

class ResourceShutdown implements OnApplicationShutdown {
  public constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository,
    @Inject(REPLAY_VERIFICATION_QUEUE) private readonly queue: ReplayVerificationQueue,
    @Inject(LEADERBOARD_CACHE) private readonly cache: LeaderboardCache,
    @Inject(ADMIN_REPOSITORY) private readonly adminRepository: AdminRepository,
  ) {}

  public async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.repository.close(),
      this.queue.close(),
      this.cache.close(),
      this.adminRepository.close(),
    ]);
  }
}

@Module({})
// Nest modules are declarative static containers by design.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class GameServerModule {
  public static register(options: GameServerModuleOptions): DynamicModule {
    const accessTokens = new AccessTokenService({
      secret: options.config.accessTokenSecret,
      issuer: options.config.accessTokenIssuer,
      audience: options.config.accessTokenAudience,
    });
    const adminAccessTokens = new AccessTokenService({
      secret: options.config.adminAccessTokenSecret,
      issuer: options.config.adminAccessTokenIssuer,
      audience: options.config.adminAccessTokenAudience,
      ttlSeconds: 900,
    });
    const adminRepository = options.adminRepository ?? new MemoryAdminRepository();
    const contentRegistry = new ContentRegistry(options.challengeContent ?? null);
    return {
      module: GameServerModule,
      controllers: [
        AdminAuthController,
        AdminController,
        AuthController,
        ContentController,
        DailyChallengeController,
        HealthController,
        LeaderboardController,
        PrivacyController,
        ProfileController,
        SaveController,
      ],
      providers: [
        { provide: GAME_REPOSITORY, useValue: options.repository },
        { provide: ADMIN_REPOSITORY, useValue: adminRepository },
        { provide: ADMIN_ACCESS_TOKENS, useValue: adminAccessTokens },
        { provide: CONTENT_REGISTRY, useValue: contentRegistry },
        { provide: WECHAT_CODE_EXCHANGE, useValue: options.wechatCodeExchange },
        { provide: SERVER_CONFIG, useValue: options.config },
        { provide: SERVER_CLOCK, useValue: options.clock ?? { now: () => new Date() } },
        { provide: CHALLENGE_CONTENT, useValue: options.challengeContent ?? null },
        {
          provide: REPLAY_VERIFICATION_QUEUE,
          useValue: options.replayVerificationQueue ?? new MemoryReplayVerificationQueue(),
        },
        {
          provide: LEADERBOARD_CACHE,
          useValue: options.leaderboardCache ?? new MemoryLeaderboardCache(),
        },
        { provide: AccessTokenService, useValue: accessTokens },
        AdminAccessGuard,
        AdminService,
        AccessGuard,
        AuthService,
        DailyChallengeService,
        IdempotencyService,
        LeaderboardService,
        PrivacyService,
        ProfileService,
        ResourceShutdown,
        SaveService,
      ],
    };
  }
}
