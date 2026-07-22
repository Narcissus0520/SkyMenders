import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { AdminService } from "../application/admin.service.js";
import { AdminAccessGuard, adminAuth } from "./admin-auth-context.js";
import type { AdminAuthenticatedRequest } from "./admin-auth-context.js";

@ApiTags("admin-auth")
@Controller("v1/admin/auth")
export class AdminAuthController {
  public constructor(@Inject(AdminService) private readonly service: AdminService) {}

  @Post("session")
  @HttpCode(200)
  public session(@Body() body: unknown) {
    return this.service.createSession(body);
  }
}

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AdminAccessGuard)
@Controller("v1/admin")
export class AdminController {
  public constructor(@Inject(AdminService) private readonly service: AdminService) {}

  @Get("overview")
  public overview(@Req() request: AdminAuthenticatedRequest) {
    return this.service.overview(adminAuth(request));
  }
  @Get("content/versions")
  public versions(@Req() request: AdminAuthenticatedRequest) {
    return this.service.contentVersions(adminAuth(request));
  }
  @Post("content/versions/:id/approve")
  public approve(
    @Req() request: AdminAuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.approveContent(adminAuth(request), id, body);
  }
  @Post("content/versions/:id/publish")
  public publish(
    @Req() request: AdminAuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.publishContent(adminAuth(request), id, body);
  }
  @Post("content/versions/:id/sign")
  public sign(
    @Req() request: AdminAuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.signContent(adminAuth(request), id, body);
  }
  @Post("content/versions/:id/freeze")
  public freeze(
    @Req() request: AdminAuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.freezeContent(adminAuth(request), id, body);
  }
  @Post("content/versions/:id/rollback")
  public rollback(
    @Req() request: AdminAuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.rollbackContent(adminAuth(request), id, body);
  }
  @Get("daily/preview")
  public daily(@Req() request: AdminAuthenticatedRequest) {
    return this.service.dailyPreview(adminAuth(request));
  }
  @Get("audit")
  public audit(@Req() request: AdminAuthenticatedRequest, @Query("limit") limit?: string) {
    return this.service.auditLog(adminAuth(request), Number(limit ?? "100"));
  }
  @Post("announcements")
  public announcement(@Req() request: AdminAuthenticatedRequest, @Body() body: unknown) {
    return this.service.announcement(adminAuth(request), body);
  }
  @Post("risk-switches/:key")
  public riskSwitch(
    @Req() request: AdminAuthenticatedRequest,
    @Param("key") key: string,
    @Body() body: unknown,
  ) {
    return this.service.riskSwitch(adminAuth(request), key, body);
  }
  @Post("leaderboard/submissions/:id/quarantine")
  public quarantine(
    @Req() request: AdminAuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.operationalAction(adminAuth(request), "score_quarantine", id, body);
  }
  @Post("accounts/:id/system-code-reset")
  public systemCode(
    @Req() request: AdminAuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.operationalAction(adminAuth(request), "system_code_reset", id, body);
  }
  @Post("privacy/deletion-requests/:id/process")
  public deletion(
    @Req() request: AdminAuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.operationalAction(adminAuth(request), "deletion_processing", id, body);
  }
}
