import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";

import { IdempotencyService } from "../application/idempotency.service.js";
import { SaveService } from "../application/save.service.js";
import { AccessGuard, auth } from "./auth-context.js";
import type { AuthenticatedRequest } from "./auth-context.js";

@ApiTags("saves")
@ApiBearerAuth()
@UseGuards(AccessGuard)
@Controller("v1/saves")
export class SaveController {
  public constructor(
    @Inject(SaveService) private readonly saves: SaveService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Get("expedition")
  public async getExpedition(@Req() request: AuthenticatedRequest) {
    return { document: await this.saves.getExpedition(auth(request).accountId) };
  }

  @Put("expedition")
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["baseRevision", "document"],
      properties: {
        baseRevision: { type: "integer", minimum: 0, nullable: true },
        document: { type: "object", description: "Strict versioned expedition save document" },
      },
    },
  })
  public async putExpedition(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
  ) {
    return this.write(request, "PUT:/v1/saves/expedition", key, () =>
      this.saves.putExpedition(auth(request).accountId, body),
    );
  }

  @Post("resolve-conflict")
  @HttpCode(200)
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["choice", "expectedCloudRevision", "localDocument"],
      properties: {
        choice: { type: "string", enum: ["local", "cloud"] },
        expectedCloudRevision: { type: "integer", minimum: 0 },
        localDocument: { type: "object", nullable: true },
      },
    },
  })
  public async resolveConflict(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
  ) {
    return this.write(request, "POST:/v1/saves/resolve-conflict", key, () =>
      this.saves.resolveConflict(auth(request).accountId, body),
    );
  }

  @Delete("expedition")
  public async deleteExpedition(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") key: string | undefined,
  ) {
    return this.write(request, "DELETE:/v1/saves/expedition", key, () =>
      this.saves.deleteExpedition(auth(request).accountId),
    );
  }

  @Get("progress")
  public async getProgress(@Req() request: AuthenticatedRequest) {
    return this.saves.getProgress(auth(request).accountId);
  }

  @Put("progress")
  @ApiBody({
    schema: { type: "object", description: "Strict versioned account progress save document" },
  })
  public async putProgress(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
  ) {
    return this.write(request, "PUT:/v1/saves/progress", key, () =>
      this.saves.mergeProgress(auth(request).accountId, body),
    );
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
