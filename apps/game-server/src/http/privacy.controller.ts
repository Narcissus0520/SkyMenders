import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";

import { IdempotencyService } from "../application/idempotency.service.js";
import { PrivacyService } from "../application/privacy.service.js";
import { AccessGuard, auth } from "./auth-context.js";
import type { AuthenticatedRequest } from "./auth-context.js";

@ApiTags("privacy")
@ApiBearerAuth()
@UseGuards(AccessGuard)
@Controller("v1/privacy")
export class PrivacyController {
  public constructor(
    @Inject(PrivacyService) private readonly privacy: PrivacyService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Post("export")
  @HttpCode(200)
  public async export(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    return this.write(request, "POST:/v1/privacy/export", key, () =>
      this.privacy.export(auth(request).accountId),
    );
  }

  @Delete("account")
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["confirmation"],
      properties: { confirmation: { type: "string", enum: ["DELETE_ACCOUNT"] } },
    },
  })
  public async deleteAccount(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.privacy.delete(auth(request).accountId, body);
  }

  @Get("requests/:requestId")
  public async status(@Req() request: AuthenticatedRequest, @Param("requestId") requestId: string) {
    return this.privacy.status(auth(request).accountId, requestId);
  }

  private async write<T>(
    request: AuthenticatedRequest,
    route: string,
    key: string | undefined,
    operation: () => Promise<T>,
  ): Promise<T> {
    const result = await this.idempotency.execute(
      auth(request).accountId,
      route,
      key,
      async () => ({
        statusCode: 200,
        response: await operation(),
      }),
    );
    return result.response;
  }
}
