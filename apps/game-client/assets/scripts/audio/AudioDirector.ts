import type { ClientSettings } from "../settings/settings.js";

export type AudioBus = "music" | "ambient" | "battle" | "ui";

export interface AudioCue {
  readonly id: string;
  readonly bus: AudioBus;
  readonly critical: boolean;
  readonly fallbackTextKey: string | null;
  readonly fallbackIconKey: string | null;
}

export interface PlayingAudio {
  readonly slot: number;
  readonly cue: AudioCue;
  readonly volumePermille: number;
}

export class AudioDirector {
  private readonly playing = new Map<number, PlayingAudio>();
  private paused = false;
  private settings: ClientSettings;

  constructor(
    settings: ClientSettings,
    readonly maximumVoices = 24,
  ) {
    if (!Number.isInteger(maximumVoices) || maximumVoices < 1 || maximumVoices > 64)
      throw new RangeError("audio voice limit must be between 1 and 64");
    this.settings = settings;
  }

  updateSettings(settings: ClientSettings): void {
    this.settings = settings;
  }

  play(cue: AudioCue): PlayingAudio | null {
    if (cue.critical && (cue.fallbackTextKey === null || cue.fallbackIconKey === null))
      throw new Error("critical audio cues require text and icon fallbacks");
    if (this.paused || this.playing.size >= this.maximumVoices) return null;
    const slot = firstFreeSlot(this.playing, this.maximumVoices);
    const playing = { slot, cue, volumePermille: effectiveVolume(cue.bus, this.settings) };
    this.playing.set(slot, playing);
    return playing;
  }

  stop(slot: number): void {
    this.playing.delete(slot);
  }
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }
  activeVoices(): readonly PlayingAudio[] {
    return [...this.playing.values()].sort((a, b) => a.slot - b.slot);
  }
}

function firstFreeSlot(playing: ReadonlyMap<number, PlayingAudio>, maximum: number): number {
  for (let slot = 0; slot < maximum; slot += 1) if (!playing.has(slot)) return slot;
  throw new Error("audio pool is unexpectedly full");
}

function effectiveVolume(bus: AudioBus, settings: ClientSettings): number {
  const local =
    bus === "music"
      ? settings.musicVolumePermille
      : bus === "ambient"
        ? settings.ambientVolumePermille
        : bus === "battle"
          ? settings.battleVolumePermille
          : settings.uiVolumePermille;
  return Math.floor((settings.masterVolumePermille * local) / 1_000);
}
