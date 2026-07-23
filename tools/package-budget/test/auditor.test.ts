import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { auditPackage } from "../src/auditor.js";

describe("WeChat package budget auditor", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root !== undefined) rmSync(root, { force: true, recursive: true });
  });

  it("partitions a compiled build and enforces internal and verified limits", () => {
    root = createRoot();
    mkdirSync(join(root, "build", "subpackages", "region"), { recursive: true });
    writeFileSync(join(root, "build", "game.js"), "12345");
    writeFileSync(join(root, "build", "subpackages", "region", "data.bin"), "1234");
    const config = writeConfig(root, {
      status: "verified",
      verifiedAt: "2026-07-23",
      sourceUrl: "https://developers.weixin.qq.com/evidence",
      mainPackageBytes: 5,
      individualSubpackageBytes: 3,
      totalPackageBytes: 8,
    });

    const result = auditPackage(config, root, true, new Date("2026-07-23T00:00:00.000Z"));
    expect(result.mode).toBe("compiled");
    expect(result.mainPackageBytes).toBe(5);
    expect(result.totalPackageBytes).toBe(9);
    expect(result.subpackages).toEqual([{ name: "region", bytes: 4 }]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "verified official total-package budget exceeded: 9 > 8",
        "verified official subpackage budget exceeded for region: 4 > 3",
      ]),
    );
  });

  it("allows source estimates for engineering but blocks them for release", () => {
    root = createRoot();
    mkdirSync(join(root, "source"), { recursive: true });
    writeFileSync(join(root, "source", "main.ts"), "source");
    const config = writeConfig(root, { status: "blocked", blockerId: "EXT-006" });

    const engineering = auditPackage(config, root, false);
    expect(engineering.errors).toEqual([]);
    expect(engineering.warnings).toHaveLength(2);
    expect(auditPackage(config, root, true).errors).toHaveLength(2);
  });

  it("rejects development files and placeholders in compiled packages", () => {
    root = createRoot();
    mkdirSync(join(root, "build", "development"), { recursive: true });
    writeFileSync(join(root, "build", "main.js.map"), "map");
    writeFileSync(join(root, "build", "development", "placeholder.png"), "asset");
    const config = writeConfig(root, { status: "blocked", blockerId: "EXT-006" });

    expect(auditPackage(config, root, false).errors).toEqual([
      "Compiled package contains a placeholder path: development/placeholder.png",
      "Compiled package contains a forbidden development file: main.js.map",
    ]);
  });

  it("returns diagnostics for invalid configuration or absent input", () => {
    root = createRoot();
    const config = join(root, "invalid.json");
    writeFileSync(config, "{}");
    expect(auditPackage(config, root, false).errors[0]).toContain(
      "Invalid package-budget configuration",
    );
    const valid = writeConfig(root, { status: "blocked", blockerId: "EXT-006" });
    expect(auditPackage(valid, root, false).errors).toEqual([
      "Package input does not exist: source",
    ]);
  });

  it("rejects stale official evidence, unsafe roots, and overlapping subpackages", () => {
    root = createRoot();
    mkdirSync(join(root, "build", "nested"), { recursive: true });
    writeFileSync(join(root, "build", "nested", "file.bin"), "x");
    const config = writeConfig(root, {
      status: "verified",
      verifiedAt: "2026-01-01",
      sourceUrl: "http://example.com/evidence",
      mainPackageBytes: 10,
      individualSubpackageBytes: 10,
      totalPackageBytes: 20,
    });
    const parsed = JSON.parse(readFileSync(config, "utf8")) as {
      subpackages: object[];
      sourceFallbackRoot: string;
    };
    parsed.subpackages = [
      { name: "one", buildDirectory: "nested", sourceDirectory: "nested" },
      { name: "two", buildDirectory: "nested", sourceDirectory: "nested" },
      { name: "unsafe", buildDirectory: "../outside", sourceDirectory: "../outside" },
    ];
    writeFileSync(config, JSON.stringify(parsed));
    expect(auditPackage(config, root, true, new Date("2026-07-23T00:00:00.000Z")).errors).toEqual(
      expect.arrayContaining([
        "Unsafe subpackage directory for unsafe: ../outside",
        "Package file belongs to overlapping subpackages one, two: nested/file.bin",
        "Official package-limit evidence must use HTTPS",
        "Official package-limit evidence is not current: 2026-01-01",
      ]),
    );

    parsed.sourceFallbackRoot = "../outside";
    writeFileSync(config, JSON.stringify(parsed));
    expect(auditPackage(config, root, false).errors).toEqual([
      "Package input roots must stay inside the repository",
    ]);
  });
});

function createRoot(): string {
  return mkdtempSync(join(tmpdir(), "skymenders-package-"));
}

function writeConfig(root: string, officialLimitEvidence: object): string {
  const path = join(root, "package-budget.json");
  writeFileSync(
    path,
    JSON.stringify({
      schemaVersion: "1.0.0",
      buildRoot: "build",
      sourceFallbackRoot: "source",
      subpackages: [
        {
          name: "region",
          buildDirectory: "subpackages/region",
          sourceDirectory: "bundles/region",
        },
      ],
      internalBudgets: {
        mainPackageBytes: 10,
        individualSubpackageBytes: 10,
        totalPackageBytes: 20,
      },
      maximumOfficialEvidenceAgeDays: 30,
      officialLimitEvidence,
    }),
  );
  return path;
}
