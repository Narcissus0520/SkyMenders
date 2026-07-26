import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { assertCocosProject, WECHAT_BUILD_CONFIG } from "./project-validator.js";

export const COCOS_EDITOR_ENVIRONMENT_KEY = "COCOS_CREATOR_PATH";
export const WECHAT_APP_ID_ENVIRONMENT_KEY = "WECHAT_MINIGAME_APP_ID";

export class CocosBuildBlockedError extends Error {
  readonly blocker: "cocos_editor" | "wechat_app_id";

  constructor(blocker: "cocos_editor" | "wechat_app_id", message: string) {
    super(message);
    this.name = "CocosBuildBlockedError";
    this.blocker = blocker;
  }
}

export interface WechatBuildDependencies {
  readonly exists: (path: string) => boolean;
  readonly makeTemporaryDirectory: () => string;
  readonly readText: (path: string) => string;
  readonly removeDirectory: (path: string) => void;
  readonly run: (
    executable: string,
    arguments_: readonly string[],
    workingDirectory: string,
  ) => number;
  readonly writeText: (path: string, content: string) => void;
}

export function createNodeWechatBuildDependencies(): WechatBuildDependencies {
  return {
    exists: existsSync,
    makeTemporaryDirectory: () => mkdtempSync(join(tmpdir(), "skymenders-cocos-")),
    readText: (path) => readFileSync(path, "utf8"),
    removeDirectory: (path) => {
      rmSync(path, { force: true, recursive: true });
    },
    run: (executable, arguments_, workingDirectory) => {
      const result = spawnSync(executable, [...arguments_], {
        cwd: workingDirectory,
        encoding: "utf8",
        stdio: "inherit",
      });
      return result.status ?? -1;
    },
    writeText: (path, content) => {
      writeFileSync(path, content, "utf8");
    },
  };
}

const defaultDependencies = createNodeWechatBuildDependencies();

export interface WechatBuildResult {
  readonly outputDirectory: string;
  readonly editorFileName: string;
  readonly status: "built";
}

export function buildWechatMiniGame(
  projectRoot: string,
  environment: Readonly<Record<string, string | undefined>>,
  dependencies: WechatBuildDependencies = defaultDependencies,
): WechatBuildResult {
  assertCocosProject(projectRoot);
  const editor = resolveCocosEditor(environment[COCOS_EDITOR_ENVIRONMENT_KEY], dependencies.exists);
  const appId = environment[WECHAT_APP_ID_ENVIRONMENT_KEY];
  if (appId === undefined || !/^wx[a-zA-Z0-9]{16}$/.test(appId)) {
    throw new CocosBuildBlockedError(
      "wechat_app_id",
      `${WECHAT_APP_ID_ENVIRONMENT_KEY} must contain a valid non-committed WeChat Mini Game AppID`,
    );
  }
  const temporaryDirectory = dependencies.makeTemporaryDirectory();
  try {
    const baseConfig = JSON.parse(
      dependencies.readText(join(projectRoot, WECHAT_BUILD_CONFIG)),
    ) as Record<string, unknown>;
    const config = injectWechatAppId(baseConfig, appId);
    const configPath = join(temporaryDirectory, "wechatgame.json");
    dependencies.writeText(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const exitCode = dependencies.run(
      editor,
      [
        "--project",
        resolve(projectRoot),
        "--build",
        `configPath=${configPath};logDest=${join(temporaryDirectory, "build.log")}`,
      ],
      projectRoot,
    );
    if (exitCode !== 0 && exitCode !== 36) {
      throw new Error(`Cocos Creator WeChat build failed with exit code ${exitCode}`);
    }
    const outputDirectory = join(projectRoot, "build", "wechatgame");
    const gameJson = join(outputDirectory, "game.json");
    if (!dependencies.exists(gameJson)) {
      throw new Error("Cocos Creator reported success but build/wechatgame/game.json is missing");
    }
    const runtimeConfig = JSON.parse(dependencies.readText(gameJson)) as Record<string, unknown>;
    if (runtimeConfig.deviceOrientation !== "landscape") {
      throw new Error("built WeChat game is not configured for landscape orientation");
    }
    const projectName =
      typeof baseConfig.name === "string" && baseConfig.name.trim() !== ""
        ? baseConfig.name
        : "SkyMenders";
    dependencies.writeText(
      join(outputDirectory, "project.config.json"),
      `${JSON.stringify(createWechatProjectConfig(appId, projectName), null, 2)}\n`,
    );
    return { outputDirectory, editorFileName: basename(editor), status: "built" };
  } finally {
    dependencies.removeDirectory(temporaryDirectory);
  }
}

export function resolveCocosEditor(
  configuredPath: string | undefined,
  exists: (path: string) => boolean = existsSync,
): string {
  if (configuredPath === undefined || configuredPath.trim() === "") {
    throw new CocosBuildBlockedError(
      "cocos_editor",
      `${COCOS_EDITOR_ENVIRONMENT_KEY} is required and must point to Cocos Creator 3.8.8`,
    );
  }
  const resolved = resolve(configuredPath);
  if (!exists(resolved)) {
    throw new CocosBuildBlockedError(
      "cocos_editor",
      `${COCOS_EDITOR_ENVIRONMENT_KEY} does not point to an existing executable`,
    );
  }
  return resolved;
}

export function injectWechatAppId(
  baseConfig: Readonly<Record<string, unknown>>,
  appId: string,
): Record<string, unknown> {
  const packages = asRecord(baseConfig.packages);
  const wechatgame = asRecord(packages.wechatgame);
  return {
    ...baseConfig,
    packages: {
      ...packages,
      wechatgame: { ...wechatgame, appid: appId },
    },
  };
}

export function createWechatProjectConfig(
  appId: string,
  projectName: string,
): Record<string, unknown> {
  return {
    description: "SkyMenders local test project",
    miniprogramRoot: "./",
    setting: {
      urlCheck: false,
      postcss: true,
      minified: true,
      newFeature: false,
      enhance: true,
      useIsolateContext: true,
    },
    compileType: "game",
    libVersion: "widelyUsed",
    appid: appId,
    projectname: projectName,
    condition: {
      search: { current: -1, list: [] },
      conversation: { current: -1, list: [] },
      game: { currentL: -1, list: [], current: -1 },
      miniprogram: { current: -1, list: [] },
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}
