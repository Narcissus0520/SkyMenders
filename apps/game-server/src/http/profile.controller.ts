import { Body, Controller, Get, Headers, Inject, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";

import { ProfileService } from "../application/profile.service.js";
import { IdempotencyService } from "../application/idempotency.service.js";
import { AccessGuard, auth } from "./auth-context.js";
import type { AuthenticatedRequest } from "./auth-context.js";

@ApiTags("profile")
@ApiBearerAuth()
@UseGuards(AccessGuard)
@Controller("v1/profile")
export class ProfileController {
  public constructor(
    @Inject(ProfileService) private readonly profiles: ProfileService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  public async get(@Req() request: AuthenticatedRequest) {
    return this.profiles.get(auth(request).accountId);
  }

  @Patch()
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      description: "Partial accessibility, input, camera, audio, and vibration settings",
    },
  })
  public async patch(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
  ) {
    const accountId = auth(request).accountId;
    const result = await this.idempotency.execute(
      accountId,
      "PATCH:/v1/profile",
      key,
      async () => ({
        statusCode: 200,
        response: await this.profiles.patchSettings(accountId, body),
      }),
    );
    return result.response;
  }

  @Get("unlocks")
  public async unlocks(@Req() request: AuthenticatedRequest) {
    return { unlockIds: await this.profiles.getUnlocks(auth(request).accountId) };
  }

  @Get("achievements")
  public async achievements(@Req() request: AuthenticatedRequest) {
    return { achievementIds: await this.profiles.getAchievements(auth(request).accountId) };
  }
}
