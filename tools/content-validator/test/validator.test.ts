import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { validateManifest } from "../src/validator.js";

describe("content manifest validator", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root !== undefined) rmSync(root, { force: true, recursive: true });
  });

  it("accepts a versioned manifest whose roots exist", () => {
    root = mkdtempSync(join(tmpdir(), "skymenders-content-"));
    const manifestDirectory = join(root, "content", "manifests");
    mkdirSync(join(root, "content", "robots"), { recursive: true });
    mkdirSync(manifestDirectory, { recursive: true });
    const path = join(manifestDirectory, "content-manifest.json");
    writeFileSync(
      path,
      JSON.stringify({
        schemaVersion: "1.0.0",
        contentVersion: "0.0.0",
        defaultLocale: "zh-CN",
        locales: ["zh-CN"],
        contentRoots: ["robots"],
      }),
    );
    expect(validateManifest(path).errors).toEqual([]);
  });

  it("reports malformed JSON, invalid fields, missing roots, and locale mismatches", () => {
    root = mkdtempSync(join(tmpdir(), "skymenders-content-"));
    const manifestDirectory = join(root, "content", "manifests");
    mkdirSync(manifestDirectory, { recursive: true });
    const path = join(manifestDirectory, "content-manifest.json");
    writeFileSync(path, "not-json");
    expect(validateManifest(path).errors[0]).toContain("Unable to parse");
    writeFileSync(path, JSON.stringify({ schemaVersion: "2" }));
    expect(validateManifest(path).errors.length).toBeGreaterThan(0);
    writeFileSync(
      path,
      JSON.stringify({
        schemaVersion: "1.0.0",
        contentVersion: "0.0.0",
        defaultLocale: "en-US",
        locales: ["zh-CN"],
        contentRoots: ["robots"],
      }),
    );
    expect(validateManifest(path).errors).toEqual([
      "Declared content root does not exist: robots",
      "defaultLocale must be present in locales",
    ]);
  });
});
