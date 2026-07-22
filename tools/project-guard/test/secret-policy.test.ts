import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { inspectSecrets } from "../src/secret-policy.js";
import { createTemporaryDirectory, removeTemporaryDirectory } from "./test-files.js";

describe("secret policy", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root !== undefined) removeTemporaryDirectory(root);
  });

  it("finds tokens, private keys, and populated WeChat secrets", () => {
    root = createTemporaryDirectory();
    const path = join(root, "unsafe.txt");
    const fakeToken = ["gh", "p_abcdefghijklmnopqrstuvwxyz123456"].join("");
    const fakePrivateKey = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
    const fakeWechatSecret = ["WECHAT_APP_", "SECRET=value"].join("");
    writeFileSync(path, `${fakeToken}\n${fakePrivateKey}\n${fakeWechatSecret}\n`);
    expect(
      inspectSecrets([path])
        .map((issue) => issue.code)
        .sort(),
    ).toEqual(["GITHUB_TOKEN", "PRIVATE_KEY", "WECHAT_SECRET"]);
  });

  it("allows empty example values", () => {
    root = createTemporaryDirectory();
    const path = join(root, "safe.txt");
    writeFileSync(path, ["WECHAT_APP_", "SECRET=\n"].join(""));
    expect(inspectSecrets([path])).toEqual([]);
  });
});
