import type { NetworkState } from "../platform/platform-adapter.js";

export type MainRoute =
  "expedition" | "daily" | "collection" | "settings" | "privacy" | "user_agreement";
export type ScreenStatus = "idle" | "loading" | "ready" | "offline" | "error";
export interface MainScreenState {
  readonly route: MainRoute | null;
  readonly status: ScreenStatus;
  readonly messageKey: string | null;
  readonly systemCodename: string;
}

export class MainMenuModel {
  private stateValue: MainScreenState;
  constructor(systemCodename = "云桥-042") {
    this.stateValue = { route: null, status: "idle", messageKey: null, systemCodename };
  }
  state(): MainScreenState {
    return this.stateValue;
  }
  async navigate(
    route: MainRoute,
    network: NetworkState,
    loader: () => Promise<void>,
  ): Promise<MainScreenState> {
    if (route === "daily" && !network.connected)
      return this.set({ route, status: "offline", messageKey: "menu.offline" });
    this.set({ route, status: "loading", messageKey: "screen.loading" });
    try {
      await loader();
      return this.set({ route, status: "ready", messageKey: null });
    } catch {
      return this.set({ route, status: "error", messageKey: "screen.error" });
    }
  }
  private set(patch: Pick<MainScreenState, "route" | "status" | "messageKey">): MainScreenState {
    this.stateValue = { ...this.stateValue, ...patch };
    return this.stateValue;
  }
}
