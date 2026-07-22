import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createTemporaryDirectory, removeTemporaryDirectory } from "./test-files.js";
import { REQUIRED_ROOT_FILES, REQUIRED_STATUS_FILES, inspectWorkspace } from "../src/policy.js";

describe("workspace policy", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root !== undefined) removeTemporaryDirectory(root);
  });

  it("reports the wrong Node major and required files", () => {
    root = createTemporaryDirectory();
    const issues = inspectWorkspace(root, "22.1.0");
    expect(issues.some((issue) => issue.code === "NODE_VERSION")).toBe(true);
    expect(issues.filter((issue) => issue.code === "REQUIRED_FILE")).toHaveLength(
      REQUIRED_ROOT_FILES.length + REQUIRED_STATUS_FILES.length,
    );
  });

  it("accepts a complete workspace and rejects mixed lockfiles", () => {
    root = createTemporaryDirectory();
    for (const file of [...REQUIRED_ROOT_FILES, ...REQUIRED_STATUS_FILES]) {
      const path = join(root, file);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, "test\n");
    }
    expect(inspectWorkspace(root, "24.2.0")).toEqual([]);
    writeFileSync(join(root, "yarn.lock"), "test\n");
    expect(inspectWorkspace(root, "24.2.0")).toContainEqual(
      expect.objectContaining({ code: "LOCKFILE_POLICY", path: "yarn.lock" }),
    );
  });
});
