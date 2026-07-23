import { describe, expect, it } from "vitest";

import {
  CURRENT_PRODUCT_VERSIONS,
  INITIAL_PRODUCT_VERSIONS,
  PHASE_1_PRODUCT_VERSIONS,
  PHASE_2_PRODUCT_VERSIONS,
  PHASE_3_PRODUCT_VERSIONS,
  PHASE_4_PRODUCT_VERSIONS,
  PHASE_5_PRODUCT_VERSIONS,
  PHASE_6_PRODUCT_VERSIONS,
  PHASE_7_PRODUCT_VERSIONS,
  PHASE_8_PRODUCT_VERSIONS,
  PHASE_9_PRODUCT_VERSIONS,
  PHASE_10_PRODUCT_VERSIONS,
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
    expect(PHASE_2_PRODUCT_VERSIONS).toEqual({
      ...PHASE_1_PRODUCT_VERSIONS,
      rulesVersion: "0.2.0",
    });
    expect(isProductVersions(PHASE_2_PRODUCT_VERSIONS)).toBe(true);
  });

  it("increments rules and protocol for the Phase 3 battle model", () => {
    expect(PHASE_3_PRODUCT_VERSIONS).toEqual({
      ...PHASE_2_PRODUCT_VERSIONS,
      protocolVersion: "0.2.0",
      rulesVersion: "0.3.0",
    });
    expect(isProductVersions(PHASE_3_PRODUCT_VERSIONS)).toBe(true);
  });

  it("increments only rules for the Phase 4 AI authority model", () => {
    expect(PHASE_4_PRODUCT_VERSIONS).toEqual({
      ...PHASE_3_PRODUCT_VERSIONS,
      rulesVersion: "0.4.0",
    });
    expect(isProductVersions(PHASE_4_PRODUCT_VERSIONS)).toBe(true);
  });

  it("increments only the client for the Phase 5 presentation model", () => {
    expect(PHASE_5_PRODUCT_VERSIONS).toEqual({
      ...PHASE_4_PRODUCT_VERSIONS,
      clientVersion: "0.1.0",
    });
  });

  it("versions the authored PvE rules, content pack, and client flow independently", () => {
    expect(PHASE_6_PRODUCT_VERSIONS).toEqual({
      ...PHASE_5_PRODUCT_VERSIONS,
      clientVersion: "0.2.0",
      contentVersion: "0.1.0",
      rulesVersion: "0.5.0",
    });
  });

  it("increments only account, save, protocol, client, and server dimensions for Phase 7", () => {
    expect(PHASE_7_PRODUCT_VERSIONS).toEqual({
      ...PHASE_6_PRODUCT_VERSIONS,
      clientVersion: "0.3.0",
      protocolVersion: "0.3.0",
      saveSchemaVersion: "0.1.0",
      serverVersion: "0.1.0",
    });
    expect(isProductVersions(PHASE_7_PRODUCT_VERSIONS)).toBe(true);
  });

  it("versions the daily client, replay contract, protocol, and server for Phase 8", () => {
    expect(PHASE_8_PRODUCT_VERSIONS).toEqual({
      ...PHASE_7_PRODUCT_VERSIONS,
      clientVersion: "0.4.0",
      protocolVersion: "0.4.0",
      replaySchemaVersion: "0.2.0",
      serverVersion: "0.2.0",
    });
    expect(isProductVersions(PHASE_8_PRODUCT_VERSIONS)).toBe(true);
  });

  it("versions the Phase 9 control-plane protocol and server independently", () => {
    expect(PHASE_9_PRODUCT_VERSIONS).toEqual({
      ...PHASE_8_PRODUCT_VERSIONS,
      protocolVersion: "0.5.0",
      serverVersion: "0.3.0",
    });
    expect(isProductVersions(PHASE_9_PRODUCT_VERSIONS)).toBe(true);
  });

  it("versions the Phase 10 release-preparation client and server surfaces", () => {
    expect(PHASE_10_PRODUCT_VERSIONS).toEqual({
      ...PHASE_9_PRODUCT_VERSIONS,
      clientVersion: "0.5.0",
      serverVersion: "0.4.0",
    });
    expect(CURRENT_PRODUCT_VERSIONS).toBe(PHASE_10_PRODUCT_VERSIONS);
    expect(isProductVersions(CURRENT_PRODUCT_VERSIONS)).toBe(true);
  });

  it("uses an explicit release channel allow-list", () => {
    expect(RELEASE_CHANNELS).toEqual(["development", "test", "release-candidate", "production"]);
  });
});
