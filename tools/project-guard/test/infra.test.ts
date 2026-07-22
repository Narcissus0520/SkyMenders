import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { inspectCompose } from "../src/infra.js";
import { createTemporaryDirectory, removeTemporaryDirectory } from "./test-files.js";

describe("Compose policy", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root !== undefined) removeTemporaryDirectory(root);
  });

  it("requires stateful services, pinned images, and healthchecks", () => {
    root = createTemporaryDirectory();
    const path = join(root, "compose.yml");
    writeFileSync(path, "services:\n  postgres:\n    image: postgres:17\n");
    const codes = inspectCompose(path).map((issue) => issue.code);
    expect(codes).toContain("COMPOSE_HEALTHCHECK");
    expect(codes.filter((code) => code === "COMPOSE_SERVICE")).toHaveLength(2);
  });
});
