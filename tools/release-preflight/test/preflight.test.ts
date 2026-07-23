import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { requiredGateIds, runPreflight } from "../src/preflight.js";

describe("release preflight", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root !== undefined) rmSync(root, { force: true, recursive: true });
  });

  it("accepts known external blockers during readiness checks", () => {
    const fixture = createFixture();
    writeEvidence(
      fixture.evidence,
      requiredGateIds.map((id) => ({
        id,
        status: "blocked",
        owner: "owner",
        blockerIds: ["EXT-001"],
        evidence: [],
      })),
    );
    const result = runPreflight(
      fixture.root,
      fixture.evidence,
      fixture.issues,
      fixture.blockers,
      false,
    );
    expect(result.errors).toEqual([]);
    expect(result.blocked).toHaveLength(requiredGateIds.length);
  });

  it("requires complete, unique gates and safe evidence paths", () => {
    const fixture = createFixture();
    writeEvidence(fixture.evidence, [
      { id: "automated-regression", status: "passed", owner: "owner", evidence: ["evidence.txt"] },
      { id: "automated-regression", status: "passed", owner: "owner", evidence: ["../escape.txt"] },
    ]);
    const result = runPreflight(
      fixture.root,
      fixture.evidence,
      fixture.issues,
      fixture.blockers,
      false,
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Release evidence contains duplicate gate IDs",
        "Release evidence is missing gate: severity-zero",
        "Release evidence path is missing or unsafe for automated-regression: ../escape.txt",
      ]),
    );
  });

  it("blocks strict release when evidence or the immutable candidate is incomplete", () => {
    const fixture = createFixture();
    const gates = requiredGateIds.map((id) =>
      id === "device-matrix"
        ? { id, status: "blocked" as const, owner: "QA", blockerIds: ["EXT-999"], evidence: [] }
        : {
            id,
            status: "passed" as const,
            owner: "owner",
            evidence: [id === "complete-audio" ? "audio-catalog.json" : "evidence.txt"],
          },
    );
    writeEvidence(fixture.evidence, gates);
    const result = runPreflight(
      fixture.root,
      fixture.evidence,
      fixture.issues,
      fixture.blockers,
      true,
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Release gate device-matrix cites an unknown blocker: EXT-999",
        "Release gate is not passed: device-matrix (EXT-999)",
        "Strict release gate requires an immutable candidate version and commit",
        "Strict release gate requires the workflow candidate version and commit",
      ]),
    );
  });

  it("detects open critical issues and malformed evidence", () => {
    const fixture = createFixture();
    writeFileSync(fixture.evidence, "{}");
    expect(
      runPreflight(fixture.root, fixture.evidence, fixture.issues, fixture.blockers, false)
        .errors[0],
    ).toContain("Invalid release evidence");
    writeEvidence(
      fixture.evidence,
      requiredGateIds.map((id) => ({
        id,
        status: "passed",
        owner: "owner",
        evidence: [id === "complete-audio" ? "audio-catalog.json" : "evidence.txt"],
      })),
      "1.0.0-rc.1",
      "a".repeat(40),
    );
    writeFileSync(fixture.issues, "## Open\n| BUG-1 | P0 | server | broken | fix |\n## Closed\n");
    expect(
      runPreflight(fixture.root, fixture.evidence, fixture.issues, fixture.blockers, true, {
        version: "1.0.0-rc.1",
        commit: "a".repeat(40),
      }).errors,
    ).toEqual(["Open P0 or P1 issue blocks the release"]);
  });

  function createFixture() {
    root = mkdtempSync(join(tmpdir(), "skymenders-release-"));
    const evidence = join(root, "release-evidence.json");
    const issues = join(root, "KNOWN_ISSUES.md");
    const blockers = join(root, "EXTERNAL_BLOCKERS.md");
    writeFileSync(join(root, "evidence.txt"), "evidence");
    writeFileSync(
      join(root, "audio-catalog.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        releaseStatus: "ready",
        music: ["menu", "explore", "risk", "boss", "results"].map((name) => ({
          cueId: `music.${name}`,
          bus: "music",
          assetId: "music_asset",
          loop: true,
        })),
        criticalCues: [
          {
            cueId: "sfx.warning",
            bus: "battle",
            assetId: "sfx_asset",
            fallbackTextKey: "audio.warning",
            fallbackIconKey: "icon.warning",
          },
        ],
        requiredSfxFamilies: ["a", "b", "c", "d", "e", "f", "g", "h"],
      }),
    );
    writeFileSync(issues, "## Open\n| ID | Severity |\n## Closed\n");
    writeFileSync(blockers, "| EXT-001 | owner |\n");
    return { root, evidence, issues, blockers };
  }
});

describe("release audio evidence", () => {
  it("rejects blocked or incomplete catalogs on a passed gate", () => {
    const root = mkdtempSync(join(tmpdir(), "skymenders-release-audio-"));
    try {
      const evidence = join(root, "release-evidence.json");
      const issues = join(root, "KNOWN_ISSUES.md");
      const blockers = join(root, "EXTERNAL_BLOCKERS.md");
      writeFileSync(join(root, "evidence.txt"), "evidence");
      writeFileSync(issues, "## Open\n| ID | Severity |\n## Closed\n");
      writeFileSync(blockers, "| EXT-001 | owner |\n");
      writeFileSync(
        join(root, "audio-catalog.json"),
        JSON.stringify({
          schemaVersion: "1.0.0",
          releaseStatus: "blocked",
          blockerId: "EXT-005",
          music: ["a", "b", "c", "d", "e"].map((name) => ({
            cueId: `music.${name}`,
            bus: "music",
            assetId: null,
          })),
          criticalCues: [
            {
              cueId: "sfx.warning",
              bus: "battle",
              assetId: null,
              fallbackTextKey: "audio.warning",
              fallbackIconKey: "icon.warning",
            },
          ],
          requiredSfxFamilies: ["a", "b", "c", "d", "e", "f", "g", "h"],
        }),
      );
      writeEvidence(
        evidence,
        requiredGateIds.map((id) => ({
          id,
          status: "passed",
          owner: "owner",
          evidence: [id === "complete-audio" ? "audio-catalog.json" : "evidence.txt"],
        })),
        "1.0.0-rc.1",
        "a".repeat(40),
      );
      expect(
        runPreflight(root, evidence, issues, blockers, true, {
          version: "1.0.0-rc.1",
          commit: "b".repeat(40),
        }).errors,
      ).toEqual(
        expect.arrayContaining([
          "Passed complete-audio gate requires a ready catalog",
          expect.stringContaining("Release audio cues are missing approved asset IDs"),
          "Release evidence candidate identity does not match the workflow ref",
        ]),
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});

function writeEvidence(
  path: string,
  gates: readonly object[],
  version: string | null = null,
  commit: string | null = null,
): void {
  writeFileSync(
    path,
    JSON.stringify({
      schemaVersion: "1.0.0",
      candidateVersion: version,
      candidateCommit: commit,
      gates,
    }),
  );
}
