import { createPublicationArtifact } from "@skymenders/content-pipeline";
import type { PveContentPack } from "@skymenders/content-schema";
import { publishedContentManifestSchema } from "@skymenders/protocol";
import type { PublishedContentManifest } from "@skymenders/protocol";
import { CURRENT_PRODUCT_VERSIONS } from "@skymenders/shared-types";

export interface PublishedContentVersion {
  readonly manifest: PublishedContentManifest;
  readonly content: PveContentPack;
}

export class ContentRegistry {
  readonly #versions = new Map<string, PublishedContentVersion>();

  public constructor(pack: PveContentPack | null, now = new Date(0)) {
    if (pack === null) return;
    const artifact = createPublicationArtifact({
      pack,
      rulesVersion: CURRENT_PRODUCT_VERSIONS.rulesVersion,
      commitSha: "embedded-content",
      createdAt: now.toISOString(),
    });
    this.#versions.set(artifact.manifest.contentVersion, {
      manifest: publishedContentManifestSchema.parse(artifact.manifest),
      content: pack,
    });
  }

  public current(): PublishedContentVersion | null {
    return (
      [...this.#versions.values()].sort((left, right) =>
        right.manifest.createdAt.localeCompare(left.manifest.createdAt),
      )[0] ?? null
    );
  }

  public get(version: string): PublishedContentVersion | null {
    return this.#versions.get(version) ?? null;
  }
}
