import type { DynamicModule, OnApplicationShutdown } from "@nestjs/common";
import { Inject, Module } from "@nestjs/common";

import { AccessTokenService } from "@skymenders/security";

import { AuthService } from "./application/auth.service.js";
import { IdempotencyService } from "./application/idempotency.service.js";
import { PrivacyService } from "./application/privacy.service.js";
import { ProfileService } from "./application/profile.service.js";
import { SaveService } from "./application/save.service.js";
import {
  GAME_REPOSITORY,
  SERVER_CLOCK,
  SERVER_CONFIG,
  WECHAT_CODE_EXCHANGE,
} from "./core/contracts.js";
import type { GameRepository, ServerClock, WechatCodeExchange } from "./core/contracts.js";
import type { ServerConfig } from "./core/server-config.js";
import { AccessGuard } from "./http/auth-context.js";
import { AuthController } from "./http/auth.controller.js";
import { HealthController } from "./http/health.controller.js";
import { PrivacyController } from "./http/privacy.controller.js";
import { ProfileController } from "./http/profile.controller.js";
import { SaveController } from "./http/save.controller.js";

export interface GameServerModuleOptions {
  readonly repository: GameRepository;
  readonly wechatCodeExchange: WechatCodeExchange;
  readonly config: ServerConfig;
  readonly clock?: ServerClock;
}

class RepositoryShutdown implements OnApplicationShutdown {
  public constructor(@Inject(GAME_REPOSITORY) private readonly repository: GameRepository) {}

  public async onApplicationShutdown(): Promise<void> {
    await this.repository.close();
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
    return {
      module: GameServerModule,
      controllers: [
        AuthController,
        HealthController,
        PrivacyController,
        ProfileController,
        SaveController,
      ],
      providers: [
        { provide: GAME_REPOSITORY, useValue: options.repository },
        { provide: WECHAT_CODE_EXCHANGE, useValue: options.wechatCodeExchange },
        { provide: SERVER_CONFIG, useValue: options.config },
        { provide: SERVER_CLOCK, useValue: options.clock ?? { now: () => new Date() } },
        { provide: AccessTokenService, useValue: accessTokens },
        AccessGuard,
        AuthService,
        IdempotencyService,
        PrivacyService,
        ProfileService,
        RepositoryShutdown,
        SaveService,
      ],
    };
  }
}
