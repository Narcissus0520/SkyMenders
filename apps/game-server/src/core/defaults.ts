import { createHash } from "node:crypto";

import { SAVE_SCHEMA_VERSION } from "@skymenders/protocol";
import type { AccountProgressSave, ProfileSettings } from "@skymenders/protocol";

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  textScalePermille: 1_000,
  highContrast: false,
  colorVisionPreset: "standard",
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

export function createInitialProgress(now: Date): AccountProgressSave {
  return {
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    logicalClock: 0,
    updatedAt: now.toISOString(),
    unlockIds: ["robot_rivet", "robot_anchor", "robot_gale"],
    achievementIds: [],
    compendiumEntryIds: [],
    completedTutorialIds: [],
    settings: DEFAULT_PROFILE_SETTINGS,
    statistics: {},
  };
}

export function createSystemCode(accountId: string): string {
  const digest = createHash("sha256").update(accountId, "utf8").digest();
  const prefixes = ["晴空", "云桥", "微风", "星轨", "浮光", "远帆"] as const;
  const suffixes = ["铆工", "测绘员", "维护者", "引航员", "修补师", "观察员"] as const;
  const prefix = prefixes[(digest[0] ?? 0) % prefixes.length];
  const suffix = suffixes[(digest[1] ?? 0) % suffixes.length];
  const number = digest.readUInt16BE(2) % 10_000;
  return `${prefix}${suffix}-${number.toString().padStart(4, "0")}`;
}
