import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertCocosProject,
  compressUuid,
  validateCocosProject,
} from "../src/project-validator.js";

const projectRoot = resolve(fileURLToPath(new URL("../../../apps/game-client", import.meta.url)));
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("Cocos project validation", () => {
  it("accepts the pinned landscape project and counts scripts", () => {
    const report = assertCocosProject(projectRoot);
    expect(report.valid).toBe(true);
    expect(report.checkedFiles).toBeGreaterThan(10);
  });

  it("compresses Cocos UUIDs and rejects malformed values", () => {
    expect(compressUuid("65624be9-0aaa-47c7-8b21-a3de4041d684")).toBe("65624vpCqpHx4sho95AQdaE");
    expect(compressUuid("not-a-uuid")).toBeNull();
  });

  it("reports malformed JSON and missing required files without throwing", () => {
    const root = copyProject();
    writeFileSync(join(root, "project.json"), "{", "utf8");
    expect(
      validateCocosProject(root).issues.some((issue) => issue.code === "COCOS_JSON_INVALID"),
    ).toBe(true);
    rmSync(join(root, "build-config", "wechatgame.json"));
    expect(
      validateCocosProject(root).issues.some((issue) => issue.code === "COCOS_FILE_MISSING"),
    ).toBe(true);
  });

  it("rejects committed identifiers, package drift, scene drift, and credential-shaped client text", () => {
    const root = copyProject();
    const path = join(root, "build-config", "wechatgame.json");
    const config = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    config.platform = "web-mobile";
    config.scenes = [];
    config.packages = {
      wechatgame: { appid: "wx1234567890123456", orientation: "portrait", separateEngine: true },
    };
    writeFileSync(path, JSON.stringify(config), "utf8");
    writeFileSync(join(root, "assets", "scripts", "bad.ts"), "const AppSecret = 'unsafe';", "utf8");
    const codes = validateCocosProject(root).issues.map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "COCOS_WECHAT_BUILD_INVALID",
        "COCOS_SCENE_LIST_INVALID",
        "COCOS_WECHAT_PACKAGE_INVALID",
        "COCOS_APP_ID_COMMITTED",
        "COCOS_CLIENT_SECRET_FORBIDDEN",
      ]),
    );
  });

  it("throws a readable aggregate from the assertion helper", () => {
    const root = copyProject();
    writeFileSync(
      join(root, "project.json"),
      JSON.stringify({ creator: { version: "3.7.0" }, type: "3d" }),
      "utf8",
    );
    expect(() => assertCocosProject(root)).toThrow(/COCOS_VERSION_INVALID/);
  });

  it("rejects remote or non-subpackage feature bundles", () => {
    const root = copyProject();
    const path = join(root, "settings", "v2", "packages", "builder.json");
    const settings = JSON.parse(readFileSync(path, "utf8")) as {
      bundleConfig: {
        custom: {
          auto_featureCollection: {
            configs: { miniGame: { overwriteSettings: { wechatgame: Record<string, unknown> } } };
          };
        };
      };
    };
    settings.bundleConfig.custom.auto_featureCollection.configs.miniGame.overwriteSettings.wechatgame =
      { compressionType: "merge_dep", isRemote: true };
    writeFileSync(path, JSON.stringify(settings), "utf8");
    expect(
      validateCocosProject(root).issues.some(
        (issue) => issue.code === "COCOS_FEATURE_BUNDLE_INVALID",
      ),
    ).toBe(true);
  });
});

function copyProject(): string {
  const root = mkdtempSync(join(tmpdir(), "skymenders-cocos-test-"));
  temporaryRoots.push(root);
  cpSync(projectRoot, root, {
    recursive: true,
    filter: (source) =>
      !source.includes("node_modules") && !source.includes("coverage") && !source.includes("dist"),
  });
  return root;
}
