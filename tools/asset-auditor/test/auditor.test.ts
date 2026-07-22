import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { auditAssets } from "../src/auditor.js";

describe("asset provenance auditor", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root !== undefined) rmSync(root, { force: true, recursive: true });
  });

  it("accepts approved commercial assets and ignores metadata", () => {
    root = mkdtempSync(join(tmpdir(), "skymenders-assets-"));
    const release = join(root, "assets", "release");
    const provenance = join(root, "assets", "provenance");
    mkdirSync(release, { recursive: true });
    mkdirSync(provenance, { recursive: true });
    writeFileSync(join(release, "robot.png"), "asset");
    writeFileSync(join(release, "README.md"), "metadata");
    const registry = join(provenance, "asset-registry.json");
    writeFileSync(
      registry,
      JSON.stringify({
        schemaVersion: "1.0.0",
        entries: [
          {
            assetId: "robot_asset",
            path: "assets/release/robot.png",
            author: "project team",
            createdAt: "2026-07-22",
            license: "project-owned",
            commercialUse: true,
            modificationAllowed: true,
            generativeAi: false,
            source: "source/robot.svg",
            reviewer: "release-owner",
            status: "approved",
          },
        ],
      }),
    );
    expect(auditAssets(registry, release).errors).toEqual([]);
  });

  it("rejects invalid registries, unregistered files, missing files, and unapproved use", () => {
    root = mkdtempSync(join(tmpdir(), "skymenders-assets-"));
    const release = join(root, "assets", "release");
    const provenance = join(root, "assets", "provenance");
    mkdirSync(release, { recursive: true });
    mkdirSync(provenance, { recursive: true });
    const registry = join(provenance, "asset-registry.json");
    writeFileSync(registry, "not-json");
    expect(auditAssets(registry, release).errors[0]).toContain("Invalid asset registry");
    writeFileSync(join(release, "unknown.png"), "asset");
    writeFileSync(join(release, "unapproved.png"), "asset");
    writeFileSync(
      registry,
      JSON.stringify({
        schemaVersion: "1.0.0",
        entries: [
          {
            assetId: "unapproved_asset",
            path: "assets/release/unapproved.png",
            author: "project team",
            createdAt: "2026-07-22",
            license: "evaluation-only",
            commercialUse: false,
            modificationAllowed: true,
            generativeAi: false,
            source: "source/unapproved.svg",
            reviewer: "release-owner",
            status: "development",
          },
          {
            assetId: "missing_asset",
            path: "assets/release/missing.png",
            author: "project team",
            createdAt: "2026-07-22",
            license: "project-owned",
            commercialUse: false,
            modificationAllowed: true,
            generativeAi: false,
            source: "source/missing.svg",
            reviewer: "release-owner",
            status: "approved",
          },
        ],
      }),
    );
    expect([...auditAssets(registry, release).errors].sort()).toEqual(
      [
        "Release asset is missing provenance: assets/release/unknown.png",
        "Release asset is not approved for commercial use: assets/release/unapproved.png",
        "Approved registry entry points to a missing file: assets/release/missing.png",
      ].sort(),
    );
  });
});
