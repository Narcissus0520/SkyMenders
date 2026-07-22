import { describe, expect, it } from "vitest";

import { INITIAL_PRODUCT_VERSIONS, RELEASE_CHANNELS, isProductVersions } from "../src/index.js";

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

  it("uses an explicit release channel allow-list", () => {
    expect(RELEASE_CHANNELS).toEqual(["development", "test", "release-candidate", "production"]);
  });
});
