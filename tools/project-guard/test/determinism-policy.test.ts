import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { inspectAuthoritySources } from "../src/determinism-policy.js";
import { createTemporaryDirectory, removeTemporaryDirectory } from "./test-files.js";

describe("authority determinism policy", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root !== undefined) removeTemporaryDirectory(root);
  });

  it("detects nondeterministic APIs and Cocos imports", () => {
    root = createTemporaryDirectory();
    const sourceRoot = join(root, "packages", "battle-core", "src");
    mkdirSync(sourceRoot, { recursive: true });
    writeFileSync(
      join(sourceRoot, "authority.ts"),
      'import { Vec2 } from "cc";\nMath.random();\nDate.now();\nvoid Vec2;\n',
    );
    expect(
      inspectAuthoritySources(root)
        .map((issue) => issue.code)
        .sort(),
    ).toEqual(["COCOS_AUTHORITY", "MATH_RANDOM", "WALL_CLOCK"]);
  });

  it("ignores tests and accepts deterministic source", () => {
    root = createTemporaryDirectory();
    const sourceRoot = join(root, "packages", "terrain-core", "src");
    mkdirSync(sourceRoot, { recursive: true });
    writeFileSync(join(sourceRoot, "grid.ts"), "export const scale = 1000;\n");
    writeFileSync(join(sourceRoot, "grid.test.ts"), "Math.random();\n");
    expect(inspectAuthoritySources(root)).toEqual([]);
  });
});
