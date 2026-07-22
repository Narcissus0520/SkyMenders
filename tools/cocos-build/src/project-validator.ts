import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const REQUIRED_COCOS_VERSION = "3.8.8";
export const WECHAT_BUILD_CONFIG = "build-config/wechatgame.json";
export const BOOTSTRAP_SCENE = "assets/scenes/Bootstrap.scene";
export const BOOTSTRAP_COMPONENT = "assets/scripts/cocos/CocosAppRoot.ts";
export const BUILDER_SETTINGS = "settings/v2/packages/builder.json";
export const FEATURE_BUNDLE_META = "assets/bundles/feature-collection.meta";

export interface CocosProjectIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface CocosProjectReport {
  readonly valid: boolean;
  readonly issues: readonly CocosProjectIssue[];
  readonly checkedFiles: number;
}

export interface CocosProjectReader {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
  readonly listFiles: (path: string) => readonly string[];
}

const fileSystemReader: CocosProjectReader = {
  exists: existsSync,
  readText: (path) => readFileSync(path, "utf8"),
  listFiles: listFilesRecursively,
};

export function validateCocosProject(
  projectRoot: string,
  reader: CocosProjectReader = fileSystemReader,
): CocosProjectReport {
  const issues: CocosProjectIssue[] = [];
  const requiredFiles = [
    "project.json",
    "package.json",
    WECHAT_BUILD_CONFIG,
    "build-templates/wechatgame/game.json",
    BOOTSTRAP_SCENE,
    `${BOOTSTRAP_SCENE}.meta`,
    BOOTSTRAP_COMPONENT,
    `${BOOTSTRAP_COMPONENT}.meta`,
    BUILDER_SETTINGS,
    FEATURE_BUNDLE_META,
  ];
  for (const path of requiredFiles) {
    if (!reader.exists(join(projectRoot, path))) {
      issue(issues, "COCOS_FILE_MISSING", path, "required Cocos project file is missing");
    }
  }
  if (issues.length > 0) return report(issues, 0);

  const project = objectAt(readJson(reader, projectRoot, "project.json", issues));
  const build = objectAt(readJson(reader, projectRoot, WECHAT_BUILD_CONFIG, issues));
  const game = objectAt(
    readJson(reader, projectRoot, "build-templates/wechatgame/game.json", issues),
  );
  const sceneMeta = objectAt(readJson(reader, projectRoot, `${BOOTSTRAP_SCENE}.meta`, issues));
  const componentMeta = objectAt(
    readJson(reader, projectRoot, `${BOOTSTRAP_COMPONENT}.meta`, issues),
  );
  const sceneValue = readJson(reader, projectRoot, BOOTSTRAP_SCENE, issues);
  const scene = Array.isArray(sceneValue) ? sceneValue : [];
  const builderSettings = objectAt(readJson(reader, projectRoot, BUILDER_SETTINGS, issues));
  const bundleMeta = objectAt(readJson(reader, projectRoot, FEATURE_BUNDLE_META, issues));

  if (objectAt(project, "creator")?.version !== REQUIRED_COCOS_VERSION) {
    issue(
      issues,
      "COCOS_VERSION_INVALID",
      "project.json",
      `creator.version must be ${REQUIRED_COCOS_VERSION}`,
    );
  }
  if (project?.type !== "2d") {
    issue(issues, "COCOS_PROJECT_TYPE_INVALID", "project.json", "client must be a 2D project");
  }

  const sceneUuid = stringAt(sceneMeta, "uuid");
  const buildPlatform = build?.platform;
  const buildTaskName = build?.taskName;
  const buildStartScene = build?.startScene;
  if (
    buildPlatform !== "wechatgame" ||
    buildTaskName !== "wechatgame" ||
    buildStartScene !== sceneUuid
  ) {
    issue(
      issues,
      "COCOS_WECHAT_BUILD_INVALID",
      WECHAT_BUILD_CONFIG,
      "WeChat build platform, task, and start scene must be explicit",
    );
  }
  const buildScenes = Array.isArray(build?.scenes) ? build.scenes : [];
  if (
    buildScenes.length !== 1 ||
    objectAt(buildScenes[0])?.url !== `db://${BOOTSTRAP_SCENE}` ||
    objectAt(buildScenes[0])?.uuid !== sceneUuid
  ) {
    issue(
      issues,
      "COCOS_SCENE_LIST_INVALID",
      WECHAT_BUILD_CONFIG,
      "build must include the bootstrap scene by UUID",
    );
  }
  const wechatPackage = objectAt(objectAt(build, "packages"), "wechatgame");
  const packageOrientation = wechatPackage?.orientation;
  const packageSeparateEngine = wechatPackage?.separateEngine;
  if (packageOrientation !== "landscape" || packageSeparateEngine !== false) {
    issue(
      issues,
      "COCOS_WECHAT_PACKAGE_INVALID",
      WECHAT_BUILD_CONFIG,
      "WeChat build must be landscape and keep the unverified engine plugin disabled",
    );
  }
  if (wechatPackage?.appid !== "") {
    issue(
      issues,
      "COCOS_APP_ID_COMMITTED",
      WECHAT_BUILD_CONFIG,
      "the repository build configuration must not contain a WeChat AppID",
    );
  }
  const deviceOrientation = game?.deviceOrientation;
  const showStatusBar = game?.showStatusBar;
  if (deviceOrientation !== "landscape" || showStatusBar !== false) {
    issue(
      issues,
      "WECHAT_GAME_CONFIG_INVALID",
      "build-templates/wechatgame/game.json",
      "WeChat runtime must request landscape and hide the status bar",
    );
  }

  const componentUuid = stringAt(componentMeta, "uuid");
  const componentType = componentUuid === null ? null : compressUuid(componentUuid);
  if (objectAt(scene[0])?.__type__ !== "cc.SceneAsset") {
    issue(issues, "COCOS_SCENE_INVALID", BOOTSTRAP_SCENE, "bootstrap scene asset is malformed");
  } else if (
    componentType === null ||
    !scene.some((entry) => objectAt(entry)?.__type__ === componentType)
  ) {
    issue(
      issues,
      "COCOS_BOOTSTRAP_COMPONENT_MISSING",
      BOOTSTRAP_SCENE,
      "bootstrap scene does not attach CocosAppRoot",
    );
  }
  if (
    componentMeta?.importer !== "typescript" ||
    objectAt(componentMeta, "userData")?.moduleId !==
      "project:///assets/scripts/cocos/CocosAppRoot.ts"
  ) {
    issue(
      issues,
      "COCOS_COMPONENT_META_INVALID",
      `${BOOTSTRAP_COMPONENT}.meta`,
      "CocosAppRoot TypeScript metadata is invalid",
    );
  }

  const bundleUserData = objectAt(bundleMeta, "userData");
  const customBundles = objectAt(objectAt(builderSettings, "bundleConfig"), "custom");
  const collectionBundle = objectAt(customBundles, "auto_featureCollection");
  const bundleConfigs = objectAt(collectionBundle, "configs");
  const miniGameConfig = objectAt(bundleConfigs, "miniGame");
  const miniGameOverrides = objectAt(miniGameConfig, "overwriteSettings");
  const wechatBundleConfig = objectAt(miniGameOverrides, "wechatgame");
  if (
    bundleUserData?.isBundle !== true ||
    bundleUserData.bundleName !== "feature-collection" ||
    bundleUserData.bundleConfigID !== "auto_featureCollection" ||
    collectionBundle?.displayName !== "feature-collection" ||
    wechatBundleConfig?.compressionType !== "subpackage" ||
    wechatBundleConfig.isRemote !== false
  ) {
    issue(
      issues,
      "COCOS_FEATURE_BUNDLE_INVALID",
      BUILDER_SETTINGS,
      "collection assets must be a local WeChat mini-game subpackage Asset Bundle",
    );
  }

  const scriptRoot = join(projectRoot, "assets", "scripts");
  const scripts = reader.listFiles(scriptRoot).filter((path) => path.endsWith(".ts"));
  const forbidden = /\b(?:AppSecret|WECHAT_APP_SECRET|wx[a-zA-Z0-9]{16})\b/;
  for (const absolutePath of scripts) {
    if (forbidden.test(reader.readText(absolutePath))) {
      issue(
        issues,
        "COCOS_CLIENT_SECRET_FORBIDDEN",
        normalize(relative(projectRoot, absolutePath)),
        "client source contains a credential-shaped value or forbidden AppSecret name",
      );
    }
  }
  return report(issues, requiredFiles.length + scripts.length);
}

export function assertCocosProject(projectRoot: string): CocosProjectReport {
  const result = validateCocosProject(projectRoot);
  if (!result.valid) {
    throw new Error(
      result.issues.map((entry) => `${entry.code} ${entry.path}: ${entry.message}`).join("\n"),
    );
  }
  return result;
}

export function compressUuid(uuid: string): string | null {
  const compact = uuid.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/i.test(compact)) return null;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = compact.slice(0, 5);
  for (let index = 5; index < compact.length; index += 3) {
    const value = Number.parseInt(compact.slice(index, index + 3), 16);
    output += alphabet[value >> 6] ?? "";
    output += alphabet[value & 63] ?? "";
  }
  return output;
}

function readJson(
  reader: CocosProjectReader,
  projectRoot: string,
  path: string,
  issues: CocosProjectIssue[],
): unknown {
  try {
    return JSON.parse(reader.readText(join(projectRoot, path))) as unknown;
  } catch (error) {
    issue(
      issues,
      "COCOS_JSON_INVALID",
      path,
      error instanceof Error ? error.message : "invalid JSON",
    );
    return null;
  }
}

function objectAt(value: unknown, key?: string): Record<string, unknown> | null {
  const selected =
    key === undefined && typeof value === "object" && value !== null
      ? value
      : typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)[key ?? ""]
        : null;
  return typeof selected === "object" && selected !== null && !Array.isArray(selected)
    ? (selected as Record<string, unknown>)
    : null;
}

function stringAt(value: unknown, key: string): string | null {
  const record = objectAt(value);
  return typeof record?.[key] === "string" ? record[key] : null;
}

function listFilesRecursively(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const name of readdirSync(root).sort(compareText)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) files.push(...listFilesRecursively(path));
    else files.push(path);
  }
  return files;
}

function issue(issues: CocosProjectIssue[], code: string, path: string, message: string): void {
  issues.push({ code, path, message });
}

function report(issues: CocosProjectIssue[], checkedFiles: number): CocosProjectReport {
  issues.sort(
    (left, right) =>
      compareText(left.code, right.code) ||
      compareText(left.path, right.path) ||
      compareText(left.message, right.message),
  );
  return { valid: issues.length === 0, issues, checkedFiles };
}

function normalize(value: string): string {
  return value.replaceAll("\\", "/");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
