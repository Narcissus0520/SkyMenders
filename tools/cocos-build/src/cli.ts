import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertCocosProject } from "./project-validator.js";
import { buildWechatMiniGame, CocosBuildBlockedError } from "./wechat-build.js";

const command = process.argv[2] ?? "check";
const projectRoot = resolve(fileURLToPath(new URL("../../../apps/game-client", import.meta.url)));

try {
  if (command === "check") {
    const result = assertCocosProject(projectRoot);
    process.stdout.write(
      `Cocos project: Creator 3.8.8, landscape WeChat configuration, ${result.checkedFiles} files passed\n`,
    );
  } else if (command === "build-wechat") {
    const result = buildWechatMiniGame(projectRoot, process.env);
    process.stdout.write(`WeChat Mini Game built at ${result.outputDirectory}\n`);
  } else {
    throw new Error(`unknown Cocos build command: ${command}`);
  }
} catch (error) {
  if (error instanceof CocosBuildBlockedError) {
    process.stderr.write(`Cocos build blocked (${error.blocker}): ${error.message}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
