import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CONTENT_REGISTRY } from "../core/admin-contracts.js";
import { ContentRegistry } from "../infrastructure/content-registry.js";
import { ApiError } from "./api-error.js";

@ApiTags("content")
@Controller("v1/content")
export class ContentController {
  public constructor(@Inject(CONTENT_REGISTRY) private readonly registry: ContentRegistry) {}

  @Get("manifest")
  public manifest() {
    const current = this.registry.current();
    if (current === null)
      throw new ApiError(503, "CONTENT_UNAVAILABLE", "No validated content is available");
    return current.manifest;
  }

  @Get("versions/:version")
  public version(@Param("version") version: string) {
    const content = this.registry.get(version);
    if (content === null)
      throw new ApiError(404, "CONTENT_VERSION_NOT_FOUND", "The content version is unavailable");
    return content;
  }
}
