import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createContentFreezeLock,
  verifyContentFreezeLock,
  writeContentFreezeLock,
} from "../src/content-freeze.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("content freeze", () => {
  it("locks the exact catalog set, content version, rules version and hashes", async () => {
    const root = await fixture();
    const lockPath = resolve(root, "freeze.json");
    const lock = createContentFreezeLock(root, "0.6.0");
    writeContentFreezeLock(lockPath, lock);
    expect(verifyContentFreezeLock(root, lockPath, "0.6.0")).toEqual([]);

    await writeFile(
      resolve(root, "content/maps/catalog.json"),
      JSON.stringify({ contentVersion: "0.2.0", maps: ["changed"] }),
    );
    expect(verifyContentFreezeLock(root, lockPath, "0.6.0")).toContain(
      "Frozen catalog hash changed: content/maps/catalog.json",
    );
    expect(verifyContentFreezeLock(root, lockPath, "9.9.9")[0]).toContain("rules version");
  });

  it("fails closed for missing, unexpected, duplicate and malformed lock entries", async () => {
    const root = await fixture();
    const lockPath = resolve(root, "freeze.json");
    const lock = createContentFreezeLock(root, "0.6.0");
    const firstCatalog = lock.catalogs.at(0);
    if (firstCatalog === undefined) throw new Error("content freeze fixture has no catalogs");
    writeContentFreezeLock(lockPath, {
      ...lock,
      catalogs: [
        firstCatalog,
        firstCatalog,
        { path: "content/unknown/catalog.json", sha256: "0".repeat(64) },
      ],
    });
    const errors = verifyContentFreezeLock(root, lockPath, "0.6.0");
    expect(errors).toContain("Content freeze lock contains duplicate catalog paths");
    expect(errors.some((error) => error.includes("missing catalog"))).toBe(true);
    expect(errors.some((error) => error.includes("unexpected catalog"))).toBe(true);

    await writeFile(lockPath, "{}", "utf8");
    expect(verifyContentFreezeLock(root, lockPath)).toHaveLength(1);
    expect(() => createContentFreezeLock(root, "latest")).toThrow("invalid");
  });
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), "skymenders-freeze-"));
  roots.push(root);
  await Promise.all([
    mkdir(resolve(root, "content/manifests"), { recursive: true }),
    mkdir(resolve(root, "content/maps"), { recursive: true }),
    mkdir(resolve(root, "content/localization"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      resolve(root, "content/manifests/content-manifest.json"),
      JSON.stringify({ contentVersion: "0.2.0" }),
    ),
    writeFile(
      resolve(root, "content/maps/catalog.json"),
      JSON.stringify({ contentVersion: "0.2.0", maps: [] }),
    ),
    writeFile(resolve(root, "content/localization/zh-CN.json"), JSON.stringify({ key: "值" })),
  ]);
  return root;
}
