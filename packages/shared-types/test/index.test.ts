import { describe, expect, it } from "vitest";

import {
  CURRENT_PRODUCT_VERSIONS,
  INITIAL_PRODUCT_VERSIONS,
  PHASE_1_PRODUCT_VERSIONS,
  RELEASE_CHANNELS,
  isProductVersions,
} from "../src/index.js";

describe("product version contract", () => {
  it("keeps compatibility dimensions independent", () => {
    expect(Object.keys(INITIAL_PRODUCT_VERSIONS).sort()).toEqual([
      "clientVersion",
      "contentVersion",
      "protocolVersion",
      "replaySchemaVersion",
      "rulesVersion",
      "saveSchemaVersion",
      "serverVersion",
    ]);
  });

  it("accepts semantic versions and rejects missing dimensions", () => {
    expect(isProductVersions(INITIAL_PRODUCT_VERSIONS)).toBe(true);
    expect(isProductVersions({ clientVersion: "0.0.0" })).toBe(false);
    expect(isProductVersions({ ...INITIAL_PRODUCT_VERSIONS, rulesVersion: "latest" })).toBe(false);
  });

  it("increments only the dimensions implemented by Phase 1", () => {
    expect(PHASE_1_PRODUCT_VERSIONS).toEqual({
      ...INITIAL_PRODUCT_VERSIONS,
      protocolVersion: "0.1.0",
      replaySchemaVersion: "0.1.0",
      rulesVersion: "0.1.0",
    });
    expect(isProductVersions(PHASE_1_PRODUCT_VERSIONS)).toBe(true);
  });

  it("increments only rules for the Phase 2 terrain model", () => {
    expect(CURRENT_PRODUCT_VERSIONS).toEqual({
      ...PHASE_1_PRODUCT_VERSIONS,
      rulesVersion: "0.2.0",
    });
    expect(isProductVersions(CURRENT_PRODUCT_VERSIONS)).toBe(true);
  });

  it("uses an explicit release channel allow-list", () => {
    expect(RELEASE_CHANNELS).toEqual(["development", "test", "release-candidate", "production"]);
  });
});
