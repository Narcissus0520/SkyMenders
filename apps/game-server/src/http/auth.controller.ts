import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";

import {
  logoutRequestSchema,
  refreshSessionRequestSchema,
  wechatLoginRequestSchema,
} from "@skymenders/protocol";

import { AuthService } from "../application/auth.service.js";

const sessionTokenBody = {
  type: "object" as const,
  additionalProperties: false,
  required: ["refreshToken"],
  properties: { refreshToken: { type: "string" as const, minLength: 43, maxLength: 256 } },
};

@ApiTags("authentication")
@Controller("v1/auth")
export class AuthController {
  public constructor(@Inject(AuthService) private readonly service: AuthService) {}

  @Post("wechat")
  @HttpCode(200)
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["code", "deviceKind"],
      properties: {
        code: { type: "string", minLength: 1, maxLength: 128 },
        deviceKind: { type: "string", enum: ["wechat", "web", "unknown"] },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Short-lived access and rotating refresh session" })
  public async wechat(@Body() body: unknown) {
    const request = wechatLoginRequestSchema.parse(body);
    return this.service.login(request.code, request.deviceKind);
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiBody({ schema: sessionTokenBody })
  @ApiResponse({ status: 200, description: "Rotated session credentials" })
  public async refresh(@Body() body: unknown) {
    const request = refreshSessionRequestSchema.parse(body);
    return this.service.refresh(request.refreshToken);
  }

  @Post("logout")
  @HttpCode(200)
  @ApiBody({ schema: sessionTokenBody })
  @ApiResponse({ status: 200, description: "Session revocation is safe to repeat" })
  public async logout(@Body() body: unknown) {
    const request = logoutRequestSchema.parse(body);
    return this.service.logout(request.refreshToken);
  }
}
