export {
  BOOTSTRAP_COMPONENT,
  BOOTSTRAP_SCENE,
  REQUIRED_COCOS_VERSION,
  WECHAT_BUILD_CONFIG,
  assertCocosProject,
  compressUuid,
  validateCocosProject,
} from "./project-validator.js";
export type {
  CocosProjectIssue,
  CocosProjectReader,
  CocosProjectReport,
} from "./project-validator.js";
export {
  COCOS_EDITOR_ENVIRONMENT_KEY,
  CocosBuildBlockedError,
  WECHAT_APP_ID_ENVIRONMENT_KEY,
  buildWechatMiniGame,
  injectWechatAppId,
  resolveCocosEditor,
} from "./wechat-build.js";
export type { WechatBuildDependencies, WechatBuildResult } from "./wechat-build.js";
