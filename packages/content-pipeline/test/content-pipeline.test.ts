import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { PveContentPack } from "@skymenders/content-schema";
import {
  CONTENT_FILE_DESCRIPTORS,
  ContentPublicationError,
  createPublicationArtifact,
  diffContent,
  evaluatePublication,
  parseContentSnapshot,
  signArtifact,
  transitionPublication,
  verifyArtifactSignature,
} from "../src/index.js";

const contentRoot = resolve(import.meta.dirname, "../../../content");

function loadFiles(): Record<string, unknown> {
  return Object.fromEntries(
    CONTENT_FILE_DESCRIPTORS.map(([, path]) => [
      path,
      JSON.parse(readFileSync(resolve(contentRoot, path), "utf8")) as unknown,
    ]),
  );
}

function loadPack(): PveContentPack {
  const result = parseContentSnapshot(loadFiles());
  expect(result.report.valid).toBe(true);
  if (result.pack === undefined) throw new Error("content fixture did not parse");
  return result.pack;
}

describe("content publication pipeline", () => {
  it("parses, validates, simulates and packages the authored content deterministically", () => {
    const pack = loadPack();
    const evaluation = evaluatePublication(pack, [13, 13, 21]);
    expect(evaluation.valid).toBe(true);
    expect(evaluation.simulation).toMatchObject({ seedCount: 2, passed: 2, failedSeeds: [] });
    expect(evaluation.artifactHash).toMatch(/^[a-f0-9]{64}$/);

    const first = createPublicationArtifact({
      pack,
      rulesVersion: "0.6.0",
      commitSha: "abc123",
      createdAt: "2026-07-22T00:00:00.000Z",
      seeds: [13, 21],
    });
    const second = createPublicationArtifact({
      pack,
      rulesVersion: "0.6.0",
      commitSha: "abc123",
      createdAt: "2026-07-22T00:00:00.000Z",
      seeds: [13, 21],
    });
    expect(first).toEqual(second);
    expect(first.payload).not.toContain("undefined");
  });

  it("returns field-specific schema errors and refuses an invalid artifact", () => {
    const files = loadFiles();
    files["robots/catalog.json"] = { schemaVersion: "1.0.0", robots: [] };
    const parsed = parseContentSnapshot(files);
    expect(parsed.report.valid).toBe(false);
    expect(
      parsed.report.issues.some((issue) => issue.path.startsWith("robots/catalog.json:")),
    ).toBe(true);

    const pack = loadPack();
    const invalid = {
      ...pack,
      maps: {
        ...pack.maps,
        maps: pack.maps.maps.map((map, index) =>
          index === 0 ? { ...map, requiredCapabilities: ["impossible_capability"] } : map,
        ),
      },
    } as PveContentPack;
    expect(() =>
      createPublicationArtifact({
        pack: invalid,
        rulesVersion: "0.6.0",
        commitSha: "abc123",
        createdAt: "2026-07-22T00:00:00.000Z",
      }),
    ).toThrow(ContentPublicationError);
  });

  it("enforces publication order, signs artifacts and reports bounded structural diffs", () => {
    expect(transitionPublication("draft", "validated")).toBe("validated");
    expect(() => transitionPublication("draft", "published")).toThrow(ContentPublicationError);
    const secret = "phase-nine-content-signing-secret-32-characters";
    const signature = signArtifact("hash", secret);
    expect(verifyArtifactSignature("hash", signature, secret)).toBe(true);
    expect(verifyArtifactSignature("different", signature, secret)).toBe(false);
    expect(diffContent({ a: 1, list: [1] }, { a: 2, list: [1, 3] })).toEqual([
      { path: "$.a", before: 1, after: 2 },
      { path: "$.list[1]", after: 3 },
    ]);
    expect(diffContent({ a: 1, b: 2 }, { a: 2, b: 3 }, 1)).toHaveLength(1);
  });
});
