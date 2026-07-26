import type {
  NetworkState,
  PlatformAdapter,
  PlatformCapabilities,
  SafeArea,
} from "../platform-adapter";
import { MockPlatformAdapter } from "../mock/MockPlatformAdapter";

interface WechatSystemInfo {
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly safeArea?: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
}

interface WechatApi {
  getSystemInfoSync(): WechatSystemInfo;
  getNetworkType(options: {
    readonly success: (result: { readonly networkType: string }) => void;
  }): void;
  login(options: {
    readonly success: (result: { readonly code?: string }) => void;
    readonly fail: (error: unknown) => void;
  }): void;
  getStorage(options: {
    readonly key: string;
    readonly success: (result: { readonly data: unknown }) => void;
    readonly fail: () => void;
  }): void;
  setStorage(options: {
    readonly key: string;
    readonly data: string;
    readonly success: () => void;
    readonly fail: (error: unknown) => void;
  }): void;
  vibrateShort(options: { readonly type: "light" | "medium"; readonly complete: () => void }): void;
  setPreferredFramesPerSecond(fps: number): void;
  onShow(listener: () => void): void;
  offShow(listener: () => void): void;
  onHide(listener: () => void): void;
  offHide(listener: () => void): void;
  onNetworkStatusChange(
    listener: (result: { readonly isConnected: boolean; readonly networkType: string }) => void,
  ): void;
  offNetworkStatusChange(
    listener: (result: { readonly isConnected: boolean; readonly networkType: string }) => void,
  ): void;
}

export class WechatPlatformAdapter implements PlatformAdapter {
  readonly capabilities: PlatformCapabilities = {
    kind: "wechat",
    touch: true,
    vibration: true,
    cloudSave: true,
  };

  constructor(private readonly api: WechatApi) {}

  getSafeArea(): SafeArea {
    const info = this.api.getSystemInfoSync();
    const safe = info.safeArea ?? {
      left: 0,
      top: 0,
      right: info.screenWidth,
      bottom: info.screenHeight,
    };
    return { ...safe, width: safe.right - safe.left, height: safe.bottom - safe.top };
  }

  getNetworkState(): Promise<NetworkState> {
    return new Promise((resolve) => {
      this.api.getNetworkType({
        success: ({ networkType }) => {
          resolve(toNetworkState(networkType));
        },
      });
    });
  }

  requestLoginCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.api.login({
        success: ({ code }) => {
          if (code === undefined || code === "") reject(new Error("WeChat login returned no code"));
          else resolve(code);
        },
        fail: (error) => {
          reject(toError(error));
        },
      });
    });
  }

  readStorage(key: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.api.getStorage({
        key,
        success: ({ data }) => {
          resolve(typeof data === "string" ? data : null);
        },
        fail: () => {
          resolve(null);
        },
      });
    });
  }

  writeStorage(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api.setStorage({
        key,
        data: value,
        success: () => {
          resolve();
        },
        fail: (error) => {
          reject(toError(error));
        },
      });
    });
  }

  vibrate(kind: "light" | "medium"): Promise<void> {
    return new Promise((resolve) => {
      this.api.vibrateShort({
        type: kind,
        complete: () => {
          resolve();
        },
      });
    });
  }

  setPreferredFrameRate(fps: 30 | 60): void {
    this.api.setPreferredFramesPerSecond(fps);
  }

  onForeground(listener: () => void): () => void {
    this.api.onShow(listener);
    return () => {
      this.api.offShow(listener);
    };
  }

  onBackground(listener: () => void): () => void {
    this.api.onHide(listener);
    return () => {
      this.api.offHide(listener);
    };
  }

  onNetworkChange(listener: (state: NetworkState) => void): () => void {
    const bridge = (result: {
      readonly isConnected: boolean;
      readonly networkType: string;
    }): void => {
      listener(
        result.isConnected
          ? toNetworkState(result.networkType)
          : { connected: false, type: "none" },
      );
    };
    this.api.onNetworkStatusChange(bridge);
    return () => {
      this.api.offNetworkStatusChange(bridge);
    };
  }
}

export function createDetectedPlatform(globalValue: unknown = globalThis): PlatformAdapter {
  const record =
    typeof globalValue === "object" && globalValue !== null
      ? (globalValue as Record<string, unknown>)
      : {};
  return record.wx === undefined
    ? new MockPlatformAdapter()
    : new WechatPlatformAdapter(record.wx as WechatApi);
}

function toNetworkState(value: string): NetworkState {
  if (value === "none") return { connected: false, type: "none" };
  if (value === "wifi") return { connected: true, type: "wifi" };
  if (value === "2g" || value === "3g" || value === "4g" || value === "5g")
    return { connected: true, type: "cellular" };
  return { connected: true, type: "unknown" };
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
