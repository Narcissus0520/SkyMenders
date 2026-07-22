import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  validateCodeCatalogAlignment,
  validateContentDirectory,
  validateManifest,
} from "../src/validator.js";

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

  it("loads the repository pack and aligns authored IDs with authority catalogs", () => {
    const contentRoot = join(import.meta.dirname, "../../..", "content");
    const result = validateContentDirectory(contentRoot);
    expect(result.report.valid).toBe(true);
    expect(result.pack).toBeDefined();
    if (result.pack === undefined) throw new Error("content pack missing");
    expect(validateCodeCatalogAlignment(result.pack)).toEqual([]);
    const firstModule = result.pack.modules.modules[0];
    const firstEnemy = result.pack.enemies.enemies[0];
    if (firstModule === undefined || firstEnemy === undefined)
      throw new Error("catalog fixture missing");
    const drifted = {
      ...result.pack,
      modules: {
        ...result.pack.modules,
        modules: result.pack.modules.modules.map((module, index) =>
          index === 0
            ? {
                ...module,
                class: "auxiliary",
                routes: [{ ...module.routes[0], id: "unknown_route" }, module.routes[1]],
              }
            : module,
        ),
      },
      enemies: {
        ...result.pack.enemies,
        enemies: [{ ...firstEnemy, id: "enemy_unknown" }, ...result.pack.enemies.enemies.slice(1)],
      },
    } as unknown as typeof result.pack;
    expect(validateCodeCatalogAlignment(drifted).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "MODULE_CLASS_MISMATCH",
        "CODE_CATALOG_ID_MISSING",
        "CODE_CATALOG_ID_UNKNOWN",
      ]),
    );
  });

  it("reports missing files and schema-invalid content directories", () => {
    root = mkdtempSync(join(tmpdir(), "skymenders-content-"));
    expect(validateContentDirectory(root).report).toMatchObject({ valid: false });
    mkdirSync(join(root, "robots"), { recursive: true });
    writeFileSync(join(root, "robots", "catalog.json"), JSON.stringify({ schemaVersion: "bad" }));
    expect(validateContentDirectory(root).report.issues.length).toBeGreaterThan(0);
  });

  it("propagates terrain validation failures from otherwise parseable templates", () => {
    root = mkdtempSync(join(tmpdir(), "skymenders-content-"));
    const source = join(import.meta.dirname, "../../..", "content");
    cpSync(source, root, { recursive: true });
    const mapPath = join(root, "maps", "catalog.json");
    const maps = JSON.parse(readFileSync(mapPath, "utf8")) as {
      maps: { playerSpawns: { x: number; y: number }[] }[];
    };
    const spawn = maps.maps[0]?.playerSpawns[0];
    if (spawn === undefined) throw new Error("map fixture missing");
    spawn.x = 63;
    writeFileSync(mapPath, JSON.stringify(maps));
    expect(
      validateContentDirectory(root).report.issues.some((issue) =>
        issue.code.startsWith("TERRAIN_"),
      ),
    ).toBe(true);
  });
});
