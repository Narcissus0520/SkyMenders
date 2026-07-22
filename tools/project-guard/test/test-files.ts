import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createTemporaryDirectory(): string {
  return mkdtempSync(join(tmpdir(), "skymenders-guard-"));
}

export function removeTemporaryDirectory(path: string): void {
  rmSync(path, { force: true, recursive: true });
}
