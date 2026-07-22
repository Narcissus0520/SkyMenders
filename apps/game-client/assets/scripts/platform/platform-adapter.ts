export interface SafeArea {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface PlatformCapabilities {
  readonly kind: "mock" | "wechat";
  readonly touch: boolean;
  readonly vibration: boolean;
  readonly cloudSave: boolean;
}

export interface NetworkState {
  readonly connected: boolean;
  readonly type: "unknown" | "none" | "wifi" | "cellular";
}

export interface PlatformAdapter {
  readonly capabilities: PlatformCapabilities;
  getSafeArea(): SafeArea;
  getNetworkState(): Promise<NetworkState>;
  requestLoginCode(): Promise<string>;
  readStorage(key: string): Promise<string | null>;
  writeStorage(key: string, value: string): Promise<void>;
  vibrate(kind: "light" | "medium"): Promise<void>;
  setPreferredFrameRate(fps: 30 | 60): void;
  onForeground(listener: () => void): () => void;
  onBackground(listener: () => void): () => void;
  onNetworkChange(listener: (state: NetworkState) => void): () => void;
}
