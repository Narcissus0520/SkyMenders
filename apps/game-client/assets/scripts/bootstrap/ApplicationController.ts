import { AudioDirector } from "../audio/AudioDirector.js";
import { Localizer } from "../localization/Localizer.js";
import type { NetworkState, PlatformAdapter } from "../platform/platform-adapter.js";
import { SettingsStore } from "../settings/settings.js";
import { MainMenuModel } from "../ui/MainMenuModel.js";

export interface ApplicationState {
  readonly status: "starting" | "ready" | "blocked_orientation" | "stopped";
  readonly network: NetworkState;
  readonly messageKey: string | null;
}

export class ApplicationController {
  readonly settings: SettingsStore;
  readonly localizer = new Localizer();
  readonly menu = new MainMenuModel();
  audio: AudioDirector | null = null;
  private stateValue: ApplicationState = {
    status: "starting",
    network: { connected: true, type: "unknown" },
    messageKey: null,
  };
  private readonly unsubscribe: (() => void)[] = [];

  constructor(readonly platform: PlatformAdapter) {
    this.settings = new SettingsStore(platform);
  }

  async start(viewportWidth: number, viewportHeight: number): Promise<ApplicationState> {
    const settings = await this.settings.load();
    this.audio = new AudioDirector(settings);
    const network = await this.platform.getNetworkState();
    this.stateValue =
      viewportWidth < viewportHeight
        ? { status: "blocked_orientation", network, messageKey: "app.landscape_required" }
        : { status: "ready", network, messageKey: null };
    this.unsubscribe.push(this.platform.onBackground(() => this.audio?.pause()));
    this.unsubscribe.push(this.platform.onForeground(() => this.audio?.resume()));
    this.unsubscribe.push(
      this.platform.onNetworkChange((next) => {
        this.stateValue = { ...this.stateValue, network: next };
      }),
    );
    this.unsubscribe.push(this.settings.subscribe((next) => this.audio?.updateSettings(next)));
    return this.stateValue;
  }

  state(): ApplicationState {
    return this.stateValue;
  }
  stop(): void {
    for (const dispose of this.unsubscribe.splice(0)) dispose();
    this.audio?.pause();
    this.stateValue = { ...this.stateValue, status: "stopped" };
  }
}
