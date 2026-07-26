import type {
  NetworkState,
  PlatformAdapter,
  PlatformCapabilities,
  SafeArea,
} from "../platform-adapter";

type Listener<T> = (value: T) => void;

export class MockPlatformAdapter implements PlatformAdapter {
  readonly capabilities: PlatformCapabilities = {
    kind: "mock",
    touch: true,
    vibration: true,
    cloudSave: false,
  };
  readonly requestedFrameRates: (30 | 60)[] = [];
  readonly vibrationLog: ("light" | "medium")[] = [];
  private readonly storage = new Map<string, string>();
  private readonly foregroundListeners = new Set<() => void>();
  private readonly backgroundListeners = new Set<() => void>();
  private readonly networkListeners = new Set<Listener<NetworkState>>();
  private network: NetworkState = { connected: true, type: "wifi" };

  constructor(
    private readonly safeArea: SafeArea = {
      left: 0,
      top: 0,
      right: 1280,
      bottom: 720,
      width: 1280,
      height: 720,
    },
  ) {}

  getSafeArea(): SafeArea {
    return this.safeArea;
  }

  getNetworkState(): Promise<NetworkState> {
    return Promise.resolve(this.network);
  }

  requestLoginCode(): Promise<string> {
    return Promise.resolve("mock-login-code");
  }

  readStorage(key: string): Promise<string | null> {
    return Promise.resolve(this.storage.get(key) ?? null);
  }

  writeStorage(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }

  vibrate(kind: "light" | "medium"): Promise<void> {
    this.vibrationLog.push(kind);
    return Promise.resolve();
  }

  setPreferredFrameRate(fps: 30 | 60): void {
    this.requestedFrameRates.push(fps);
  }

  onForeground(listener: () => void): () => void {
    this.foregroundListeners.add(listener);
    return () => this.foregroundListeners.delete(listener);
  }

  onBackground(listener: () => void): () => void {
    this.backgroundListeners.add(listener);
    return () => this.backgroundListeners.delete(listener);
  }

  onNetworkChange(listener: Listener<NetworkState>): () => void {
    this.networkListeners.add(listener);
    return () => this.networkListeners.delete(listener);
  }

  emitForeground(): void {
    for (const listener of this.foregroundListeners) listener();
  }

  emitBackground(): void {
    for (const listener of this.backgroundListeners) listener();
  }

  emitNetwork(state: NetworkState): void {
    this.network = state;
    for (const listener of this.networkListeners) listener(state);
  }
}
