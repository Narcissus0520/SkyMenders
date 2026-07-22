import { describe, expect, it } from "vitest";

import {
  accountProgressSaveSchema,
  expeditionSaveDocumentSchema,
  profileSettingsPatchSchema,
  resolveSaveConflictRequestSchema,
  runtimeSnapshotSchema,
  sessionResponseSchema,
  wechatLoginRequestSchema,
} from "../src/index.js";

describe("account and save protocol", () => {
  it("accepts bounded account progress and partial accessibility settings", () => {
    expect(
      accountProgressSaveSchema.parse({
        saveSchemaVersion: "0.1.0",
        logicalClock: 7,
        updatedAt: "2026-07-22T08:00:00.000Z",
        unlockIds: ["robot_rivet"],
        achievementIds: [],
        compendiumEntryIds: [],
        completedTutorialIds: ["tutorial_movement"],
        settings: settings(),
        statistics: { expeditions_started: 1 },
      }).logicalClock,
    ).toBe(7);
    expect(profileSettingsPatchSchema.parse({ reduceFlash: true })).toEqual({ reduceFlash: true });
    expect(profileSettingsPatchSchema.safeParse({ unknown: true }).success).toBe(false);
  });

  it("keeps platform credentials and session fields explicit", () => {
    expect(wechatLoginRequestSchema.parse({ code: "one-use-code", deviceKind: "wechat" })).toEqual({
      code: "one-use-code",
      deviceKind: "wechat",
    });
    expect(
      sessionResponseSchema.safeParse({
        accessToken: "x".repeat(64),
        accessExpiresAt: "2026-07-22T08:15:00.000Z",
        refreshToken: "y".repeat(64),
        refreshExpiresAt: "2026-08-21T08:00:00.000Z",
        accountId: "018f0f40-7b1a-7000-8000-000000000001",
        openId: "must-never-leak",
      }).success,
    ).toBe(false);
  });

  it("requires a local save when resolving a conflict in favor of the device", () => {
    expect(
      resolveSaveConflictRequestSchema.safeParse({
        choice: "local",
        expectedCloudRevision: 2,
        localDocument: null,
      }).success,
    ).toBe(false);
    expect(
      resolveSaveConflictRequestSchema.parse({
        choice: "cloud",
        expectedCloudRevision: 2,
        localDocument: null,
      }).choice,
    ).toBe("cloud");
  });

  it("rejects malformed expedition documents before persistence", () => {
    expect(
      expeditionSaveDocumentSchema.safeParse({
        saveSchemaVersion: "0.1.0",
        saveId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("validates nonzero deterministic RNG state in recovery snapshots", () => {
    const base = {
      snapshotSchemaVersion: "0.1.0",
      rulesVersion: "0.5.0",
      contentVersion: "0.1.0",
      replaySchemaVersion: "0.1.0",
      turnIndex: 0,
      commandIndex: 0,
      state: { turn: 0 },
      stateHash: "0123456789abcdef",
    } as const;
    expect(
      runtimeSnapshotSchema.safeParse({ ...base, rngStates: { map: [1, 0, 0, 0] } }).success,
    ).toBe(true);
    expect(
      runtimeSnapshotSchema.safeParse({ ...base, rngStates: { map: [0, 0, 0, 0] } }).success,
    ).toBe(false);
  });
});

function settings() {
  return {
    textScalePermille: 1_000,
    highContrast: false,
    colorVisionPreset: "standard" as const,
    reduceFlash: false,
    reduceCameraMotion: false,
    cameraShakePermille: 1_000,
    leftHanded: false,
    aimingSensitivityPermille: 1_000,
    cameraSensitivityPermille: 1_000,
    releaseToFire: false,
    masterVolumePermille: 1_000,
    musicVolumePermille: 800,
    ambientVolumePermille: 800,
    combatVolumePermille: 1_000,
    uiVolumePermille: 1_000,
    vibration: true,
  };
}
