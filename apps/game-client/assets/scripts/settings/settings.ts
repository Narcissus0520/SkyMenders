import type { PlatformAdapter } from "../platform/platform-adapter";

export const SETTINGS_STORAGE_KEY = "settings.v1";
export const SETTINGS_SCHEMA_VERSION = "0.1.0";
export const COLOR_VISION_PRESETS = [
  "standard",
  "deuteranopia",
  "protanopia",
  "tritanopia",
] as const;
export type ColorVisionPreset = (typeof COLOR_VISION_PRESETS)[number];

export interface ClientSettings {
  readonly schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  readonly colorVision: ColorVisionPreset;
  readonly textScalePermille: number;
  readonly highContrast: boolean;
  readonly reducedFlash: boolean;
  readonly reducedMotion: boolean;
  readonly reducedShake: boolean;
  readonly handedness: "left" | "right";
  readonly aimSensitivityPermille: number;
  readonly cameraSensitivityPermille: number;
  readonly requireFireConfirmation: true;
  readonly masterVolumePermille: number;
  readonly musicVolumePermille: number;
  readonly ambientVolumePermille: number;
  readonly battleVolumePermille: number;
  readonly uiVolumePermille: number;
  readonly vibration: boolean;
  readonly preferredFrameRate: 30 | 60;
}

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  colorVision: "standard",
  textScalePermille: 1_000,
  highContrast: false,
  reducedFlash: false,
  reducedMotion: false,
  reducedShake: false,
  handedness: "right",
  aimSensitivityPermille: 1_000,
  cameraSensitivityPermille: 1_000,
  requireFireConfirmation: true,
  masterVolumePermille: 800,
  musicVolumePermille: 650,
  ambientVolumePermille: 650,
  battleVolumePermille: 800,
  uiVolumePermille: 800,
  vibration: true,
  preferredFrameRate: 60,
};

export class SettingsStore {
  private value: ClientSettings = DEFAULT_CLIENT_SETTINGS;
  private readonly listeners = new Set<(settings: ClientSettings) => void>();

  constructor(private readonly platform: PlatformAdapter) {}

  current(): ClientSettings {
    return this.value;
  }

  async load(): Promise<ClientSettings> {
    const stored = await this.platform.readStorage(SETTINGS_STORAGE_KEY);
    this.value = normalizeSettings(stored === null ? null : safeParse(stored));
    this.platform.setPreferredFrameRate(this.value.preferredFrameRate);
    this.publish();
    return this.value;
  }

  async update(patch: Partial<ClientSettings>): Promise<ClientSettings> {
    this.value = normalizeSettings({ ...this.value, ...patch });
    await this.platform.writeStorage(SETTINGS_STORAGE_KEY, JSON.stringify(this.value));
    this.platform.setPreferredFrameRate(this.value.preferredFrameRate);
    this.publish();
    return this.value;
  }

  subscribe(listener: (settings: ClientSettings) => void): () => void {
    this.listeners.add(listener);
    listener(this.value);
    return () => this.listeners.delete(listener);
  }

  private publish(): void {
    for (const listener of this.listeners) listener(this.value);
  }
}

export function normalizeSettings(value: unknown): ClientSettings {
  const input =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    colorVision: includes(COLOR_VISION_PRESETS, input.colorVision)
      ? input.colorVision
      : DEFAULT_CLIENT_SETTINGS.colorVision,
    textScalePermille: integer(
      input.textScalePermille,
      800,
      1_400,
      DEFAULT_CLIENT_SETTINGS.textScalePermille,
    ),
    highContrast: boolean(input.highContrast, DEFAULT_CLIENT_SETTINGS.highContrast),
    reducedFlash: boolean(input.reducedFlash, DEFAULT_CLIENT_SETTINGS.reducedFlash),
    reducedMotion: boolean(input.reducedMotion, DEFAULT_CLIENT_SETTINGS.reducedMotion),
    reducedShake: boolean(input.reducedShake, DEFAULT_CLIENT_SETTINGS.reducedShake),
    handedness: input.handedness === "left" ? "left" : "right",
    aimSensitivityPermille: integer(
      input.aimSensitivityPermille,
      500,
      2_000,
      DEFAULT_CLIENT_SETTINGS.aimSensitivityPermille,
    ),
    cameraSensitivityPermille: integer(
      input.cameraSensitivityPermille,
      500,
      2_000,
      DEFAULT_CLIENT_SETTINGS.cameraSensitivityPermille,
    ),
    requireFireConfirmation: true,
    masterVolumePermille: integer(
      input.masterVolumePermille,
      0,
      1_000,
      DEFAULT_CLIENT_SETTINGS.masterVolumePermille,
    ),
    musicVolumePermille: integer(
      input.musicVolumePermille,
      0,
      1_000,
      DEFAULT_CLIENT_SETTINGS.musicVolumePermille,
    ),
    ambientVolumePermille: integer(
      input.ambientVolumePermille,
      0,
      1_000,
      DEFAULT_CLIENT_SETTINGS.ambientVolumePermille,
    ),
    battleVolumePermille: integer(
      input.battleVolumePermille,
      0,
      1_000,
      DEFAULT_CLIENT_SETTINGS.battleVolumePermille,
    ),
    uiVolumePermille: integer(
      input.uiVolumePermille,
      0,
      1_000,
      DEFAULT_CLIENT_SETTINGS.uiVolumePermille,
    ),
    vibration: boolean(input.vibration, DEFAULT_CLIENT_SETTINGS.vibration),
    preferredFrameRate: input.preferredFrameRate === 30 ? 30 : 60,
  };
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function integer(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function includes<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}
