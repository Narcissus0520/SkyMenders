import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSbom } from "../src/sbom.js";

describe("CycloneDX SBOM generator", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root !== undefined) rmSync(root, { force: true, recursive: true });
  });

  it("converts sorted scoped and unscoped pnpm packages with integrity hashes", () => {
    root = mkdtempSync(join(tmpdir(), "skymenders-sbom-"));
    const path = join(root, "pnpm-lock.yaml");
    writeFileSync(
      path,
      [
        "lockfileVersion: '9.0'",
        "packages:",
        "  zod@4.4.3: {}",
        "  '@scope/pkg@1.2.3':",
        "    resolution: {integrity: sha512-YQ==}",
      ].join("\n"),
    );

    const bom = createSbom(path, "0.0.0");
    expect(bom).toMatchObject({ bomFormat: "CycloneDX", specVersion: "1.6", version: 1 });
    expect(bom.components.map((component) => component.name)).toEqual(["@scope/pkg", "zod"]);
    expect(bom.components[0]?.hashes?.[0]).toEqual({ alg: "SHA-512", content: "61" });
  });

  it("rejects unsupported keys and omits non-sha512 integrity", () => {
    root = mkdtempSync(join(tmpdir(), "skymenders-sbom-"));
    const path = join(root, "pnpm-lock.yaml");
    writeFileSync(path, "packages:\n  package@1.0.0:\n    resolution: {integrity: sha1-YQ==}\n");
    expect(createSbom(path, "0.0.0").components[0]?.hashes).toBeUndefined();
    writeFileSync(path, "packages:\n  invalid: {}\n");
    expect(() => createSbom(path, "0.0.0")).toThrow("Unsupported pnpm package key");
  });
});
