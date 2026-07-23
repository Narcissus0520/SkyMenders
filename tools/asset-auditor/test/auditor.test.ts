import { createHash } from "node:crypto";
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

  it("accepts a release asset with complete approved provenance", () => {
    const fixture = createFixture("robot.png", "asset");
    writeRegistry(fixture.registry, [approvedEntry("robot.png", "asset")]);

    expect(auditAssets(fixture.registry, fixture.release)).toEqual({
      errors: [],
      auditedReleaseFiles: 1,
    });
  });

  it("rejects invalid registries and unregistered release files", () => {
    const fixture = createFixture("unknown.png", "asset");
    writeFileSync(fixture.registry, "not-json");
    expect(auditAssets(fixture.registry, fixture.release).errors[0]).toContain(
      "Invalid asset registry",
    );
    writeRegistry(fixture.registry, []);
    expect(auditAssets(fixture.registry, fixture.release).errors).toEqual([
      "Release asset is missing provenance: assets/release/unknown.png",
    ]);
  });

  it("rejects incomplete approval, prohibited provenance, and mismatched hashes", () => {
    const fixture = createFixture("Worms-font.ttf", "font");
    writeRegistry(
      fixture.registry,
      [
        {
          ...approvedEntry("Worms-font.ttf", "different"),
          assetId: "worms_font",
          license: "evaluation-only",
          commercialUse: false,
          generativeAi: { used: true, tool: "generator", process: "prompt", approved: false },
          referenceSources: ["Worms screenshot"],
          status: "development",
          placeholder: true,
          sourceFile: "assets/provenance/missing-source.svg",
          licenseEvidence: "assets/provenance/missing-license.txt",
        },
      ],
      [createHash("sha256").update("font").digest("hex")],
    );

    expect(auditAssets(fixture.registry, fixture.release).errors).toEqual(
      expect.arrayContaining([
        "Release asset path contains a prohibited competitor term: assets/release/Worms-font.ttf",
        "Release asset is not approved for commercial use: assets/release/Worms-font.ttf",
        "Release asset is marked as a placeholder: assets/release/Worms-font.ttf",
        "Release asset uses a prohibited license: assets/release/Worms-font.ttf",
        "Release asset has unapproved generative-AI provenance: assets/release/Worms-font.ttf",
        "Release asset provenance contains a prohibited competitor term: assets/release/Worms-font.ttf",
        "Release asset source file is missing: assets/release/Worms-font.ttf",
        "Release asset license evidence is missing: assets/release/Worms-font.ttf",
        "Release asset hash does not match registry: assets/release/Worms-font.ttf",
        "Release asset matches a prohibited fingerprint: assets/release/Worms-font.ttf",
      ]),
    );
  });

  it("rejects duplicate IDs and paths plus approved missing or escaping files", () => {
    const fixture = createFixture(undefined, undefined);
    const first = approvedEntry("missing.png", "missing");
    writeRegistry(fixture.registry, [
      first,
      { ...first },
      { ...approvedEntry("../../../escape.png", "x"), assetId: "escape" },
    ]);

    expect(auditAssets(fixture.registry, fixture.release).errors).toEqual(
      expect.arrayContaining([
        "Duplicate asset path: assets/release/missing.png",
        "Duplicate asset ID: robot_asset",
        "Approved registry entry points to a missing file: assets/release/missing.png",
        "Registry asset path is outside assets/release: assets/release/../../../escape.png",
        "Approved asset path escapes the repository: assets/release/../../../escape.png",
      ]),
    );
  });

  it("fails a strict audit when the final release categories are incomplete", () => {
    const fixture = createFixture("robot.png", "asset");
    writeRegistry(fixture.registry, [approvedEntry("robot.png", "asset")]);
    expect(auditAssets(fixture.registry, fixture.release, true).errors).toEqual([
      "Strict release audit is missing approved font assets",
      "Strict release audit is missing approved music assets",
      "Strict release audit is missing approved sfx assets",
      "Strict release audit is missing approved ui assets",
    ]);

    rmSync(join(fixture.release, "robot.png"));
    writeRegistry(fixture.registry, []);
    expect(auditAssets(fixture.registry, fixture.release, true).errors).toContain(
      "Strict release audit requires approved release assets",
    );
  });

  function createFixture(fileName: string | undefined, contents: string | undefined) {
    root = mkdtempSync(join(tmpdir(), "skymenders-assets-"));
    const release = join(root, "assets", "release");
    const provenance = join(root, "assets", "provenance");
    mkdirSync(release, { recursive: true });
    mkdirSync(provenance, { recursive: true });
    writeFileSync(join(provenance, "source.svg"), "source");
    writeFileSync(join(provenance, "license.txt"), "project-owned");
    writeFileSync(join(release, "README.md"), "metadata");
    if (fileName !== undefined && contents !== undefined)
      writeFileSync(join(release, fileName), contents);
    return { release, registry: join(provenance, "asset-registry.json") };
  }
});

function approvedEntry(fileName: string, contents: string) {
  return {
    assetId: "robot_asset",
    path: `assets/release/${fileName}`,
    category: "art",
    author: "project team",
    createdAt: "2026-07-22",
    sourceFile: "assets/provenance/source.svg",
    sourceLocation: "internal commission",
    license: "project-owned",
    licenseEvidence: "assets/provenance/license.txt",
    commercialUse: true,
    modificationAllowed: true,
    generativeAi: { used: false },
    referenceSources: [],
    sha256: createHash("sha256").update(contents).digest("hex"),
    reviewer: "release-owner",
    reviewedAt: "2026-07-22",
    status: "approved",
    placeholder: false,
  } as const;
}

function writeRegistry(
  registry: string,
  entries: readonly object[],
  forbiddenFingerprints: readonly string[] = [],
): void {
  writeFileSync(
    registry,
    JSON.stringify({ schemaVersion: "2.0.0", forbiddenFingerprints, entries }),
  );
}
