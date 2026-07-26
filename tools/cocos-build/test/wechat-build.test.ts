import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildWechatMiniGame,
  CocosBuildBlockedError,
  createWechatProjectConfig,
  createNodeWechatBuildDependencies,
  disableDefaultSplashAssets,
  injectWechatAppId,
  resolveCocosEditor,
} from "../src/wechat-build.js";
import type { WechatBuildDependencies } from "../src/wechat-build.js";

const projectRoot = resolve(fileURLToPath(new URL("../../../apps/game-client", import.meta.url)));

describe("WeChat Cocos build wrapper", () => {
  it("requires an existing editor path before requesting an AppID", () => {
    expect(() => resolveCocosEditor(undefined, () => false)).toThrow(CocosBuildBlockedError);
    expect(() => resolveCocosEditor("C:/missing.exe", () => false)).toThrow(/existing executable/);
    expect(resolveCocosEditor("C:/Creator.exe", () => true)).toContain("Creator.exe");
  });

  it("provides functional Node filesystem and subprocess dependencies", () => {
    const dependencies = createNodeWechatBuildDependencies();
    const directory = dependencies.makeTemporaryDirectory();
    const path = join(directory, "probe.txt");
    dependencies.writeText(path, "ok");
    expect(dependencies.exists(path)).toBe(true);
    expect(dependencies.readText(path)).toBe("ok");
    expect(dependencies.run(process.execPath, ["-e", "process.exit(0)"], projectRoot)).toBe(0);
    dependencies.removeDirectory(directory);
    expect(existsSync(directory)).toBe(false);
  });

  it("injects a runtime AppID without mutating the committed configuration", () => {
    const source = { packages: { wechatgame: { appid: "", orientation: "landscape" } } };
    const result = injectWechatAppId(source, "wx1234567890123456");
    expect((result.packages as { wechatgame: { appid: string } }).wechatgame.appid).toBe(
      "wx1234567890123456",
    );
    expect(source.packages.wechatgame.appid).toBe("");
    expect(injectWechatAppId({}, "wx1234567890123456")).toHaveProperty("packages.wechatgame.appid");
  });

  it("creates a valid local WeChat project configuration", () => {
    const config = createWechatProjectConfig("wx1234567890123456", "SkyMenders");
    expect(config).toMatchObject({
      appid: "wx1234567890123456",
      compileType: "game",
      projectname: "SkyMenders",
      setting: { urlCheck: false },
    });
    expect(JSON.parse(JSON.stringify(config))).toEqual(config);
  });

  it("disables and removes Creator default splash assets deterministically", () => {
    const writes: { readonly path: string; readonly content: string }[] = [];
    const removals: string[] = [];
    disableDefaultSplashAssets("C:/build/wechatgame", {
      readText: () => "before\nlet useLogo = true;\nafter\n",
      removeFile: (path) => {
        removals.push(path);
      },
      writeText: (path, content) => {
        writes.push({ path, content });
      },
    });
    expect(writes).toHaveLength(1);
    expect(writes[0]?.path).toContain("first-screen.js");
    expect(writes[0]?.content).toBe("before\nlet useLogo = false;\nafter\n");
    expect(removals).toEqual([
      expect.stringContaining("logo.png"),
      expect.stringContaining("slogan.png"),
    ]);
  });

  it("rejects an unexpected Creator first-screen template", () => {
    expect(() => {
      disableDefaultSplashAssets("C:/build/wechatgame", {
        readText: () => "const useLogo = true;",
        removeFile: () => {
          throw new Error("remove should not run");
        },
        writeText: () => {
          throw new Error("write should not run");
        },
      });
    }).toThrow(/marker drifted/);
  });

  it("reports a missing runtime AppID as an explicit external blocker", () => {
    expect(() =>
      buildWechatMiniGame(
        projectRoot,
        { COCOS_CREATOR_PATH: "C:/Creator.exe" },
        fakeDependencies(),
      ),
    ).toThrow(/WECHAT_MINIGAME_APP_ID/);
  });

  it("accepts documented success exit 36, validates output, and always cleans temporary data", () => {
    const calls: string[] = [];
    const dependencies = fakeDependencies({ calls, exitCode: 36 });
    const result = buildWechatMiniGame(
      projectRoot,
      { COCOS_CREATOR_PATH: "C:/Creator.exe", WECHAT_MINIGAME_APP_ID: "wx1234567890123456" },
      dependencies,
    );
    expect(result).toMatchObject({ status: "built", editorFileName: "Creator.exe" });
    expect(calls).toEqual(expect.arrayContaining(["write", "run", "remove"]));
    expect(calls.filter((call) => call === "write")).toHaveLength(2);
  });

  it("rejects failed builds, missing output, and portrait output while cleaning", () => {
    const failedCalls: string[] = [];
    expect(() =>
      buildWechatMiniGame(
        projectRoot,
        environment(),
        fakeDependencies({ calls: failedCalls, exitCode: 34 }),
      ),
    ).toThrow(/exit code 34/);
    expect(failedCalls.at(-1)).toBe("remove");
    expect(() =>
      buildWechatMiniGame(projectRoot, environment(), fakeDependencies({ outputExists: false })),
    ).toThrow(/game.json is missing/);
    expect(() =>
      buildWechatMiniGame(
        projectRoot,
        environment(),
        fakeDependencies({ orientation: "portrait" }),
      ),
    ).toThrow(/landscape/);
  });
});

function environment() {
  return { COCOS_CREATOR_PATH: "C:/Creator.exe", WECHAT_MINIGAME_APP_ID: "wx1234567890123456" };
}

function fakeDependencies(
  options: {
    readonly calls?: string[];
    readonly exitCode?: number;
    readonly outputExists?: boolean;
    readonly orientation?: string;
  } = {},
): WechatBuildDependencies {
  const calls = options.calls ?? [];
  return {
    exists: (path) =>
      path.endsWith("Creator.exe") ||
      (path.endsWith("game.json") && options.outputExists !== false),
    makeTemporaryDirectory: () => "C:/temp/skymenders",
    readText: (path) =>
      path.includes("build-config")
        ? '{"packages":{"wechatgame":{"appid":"","orientation":"landscape"}}}'
        : JSON.stringify({ deviceOrientation: options.orientation ?? "landscape" }),
    removeDirectory: () => {
      calls.push("remove");
    },
    removeFile: () => {
      calls.push("remove-file");
    },
    run: (_executable, arguments_) => {
      calls.push("run");
      expect(arguments_.join(" ")).toContain("configPath=");
      return options.exitCode ?? 0;
    },
    writeText: (_path, content) => {
      calls.push("write");
      expect(content).toContain("wx1234567890123456");
    },
  };
}
