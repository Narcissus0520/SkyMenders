import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";

import { DailyChallengeService } from "../application/daily-challenge.service.js";
import { IdempotencyService } from "../application/idempotency.service.js";
import { AccessGuard, auth } from "./auth-context.js";
import type { AuthenticatedRequest } from "./auth-context.js";

@ApiTags("daily-challenge")
@ApiBearerAuth()
@UseGuards(AccessGuard)
@Controller("v1/challenges/daily")
export class DailyChallengeController {
  public constructor(
    @Inject(DailyChallengeService) private readonly challenges: DailyChallengeService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  public async getDaily(@Req() request: AuthenticatedRequest) {
    return this.challenges.getDaily(auth(request).accountId);
  }

  @Post("practice/start")
  @HttpCode(200)
  public async startPractice(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    return this.write(request, "POST:/v1/challenges/daily/practice/start", key, () =>
      this.challenges.startPractice(auth(request).accountId),
    );
  }

  @Post("attempts/start")
  @HttpCode(200)
  public async startFormal(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    return this.write(request, "POST:/v1/challenges/daily/attempts/start", key, () =>
      this.challenges.startFormal(auth(request).accountId),
    );
  }

  @Put("attempts/:id/checkpoint")
  @ApiBody({ schema: { type: "object", description: "Strict attempt boundary checkpoint" } })
  public async checkpoint(
    @Req() request: AuthenticatedRequest,
    @Param("id") attemptId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
  ) {
    return this.write(
      request,
      `PUT:/v1/challenges/daily/attempts/${attemptId}/checkpoint`,
      key,
      () => this.challenges.checkpoint(auth(request).accountId, attemptId, body),
    );
  }

  @Post("attempts/:id/finish")
  @HttpCode(200)
  @ApiBody({ schema: { type: "object", description: "Versioned command replay submission" } })
  public async finish(
    @Req() request: AuthenticatedRequest,
    @Param("id") attemptId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
  ) {
    return this.write(request, `POST:/v1/challenges/daily/attempts/${attemptId}/finish`, key, () =>
      this.challenges.finish(auth(request).accountId, attemptId, body),
    );
  }

  @Post("attempts/:id/abandon")
  @HttpCode(200)
  public async abandon(
    @Req() request: AuthenticatedRequest,
    @Param("id") attemptId: string,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    return this.write(request, `POST:/v1/challenges/daily/attempts/${attemptId}/abandon`, key, () =>
      this.challenges.abandon(auth(request).accountId, attemptId),
    );
  }

  private async write<T>(
    request: AuthenticatedRequest,
    route: string,
    key: string | undefined,
    operation: () => Promise<T>,
  ): Promise<T> {
    return (
      await this.idempotency.execute(auth(request).accountId, route, key, async () => ({
        statusCode: 200,
        response: await operation(),
      }))
    ).response;
  }
}
