import { describe, expect, it, vi } from "vitest";

import {
  factionSemantic,
  buildValiditySemantic,
  touchTargetSize,
} from "../assets/scripts/accessibility/accessibility.js";
import { AudioDirector } from "../assets/scripts/audio/AudioDirector.js";
import { ApplicationController } from "../assets/scripts/bootstrap/ApplicationController.js";
import { Localizer } from "../assets/scripts/localization/Localizer.js";
import { MockPlatformAdapter } from "../assets/scripts/platform/mock/MockPlatformAdapter.js";
import {
  createDetectedPlatform,
  WechatPlatformAdapter,
} from "../assets/scripts/platform/wechat/WechatPlatformAdapter.js";
import {
  DEFAULT_CLIENT_SETTINGS,
  normalizeSettings,
  SettingsStore,
} from "../assets/scripts/settings/settings.js";
import { MainMenuModel } from "../assets/scripts/ui/MainMenuModel.js";

describe("settings and accessibility", () => {
  it("normalizes invalid and out-of-range values", () => {
    const result = normalizeSettings({
      colorVision: "bad",
      textScalePermille: 4_000,
      handedness: "left",
      preferredFrameRate: 30,
      requireFireConfirmation: false,
    });
    expect(result.colorVision).toBe("standard");
    expect(result.textScalePermille).toBe(1_400);
    expect(result.handedness).toBe("left");
    expect(result.preferredFrameRate).toBe(30);
    expect(result.requireFireConfirmation).toBe(true);
  });

  it("loads defaults, persists updates, publishes, and requests frame rate", async () => {
    const platform = new MockPlatformAdapter();
    const store = new SettingsStore(platform);
    const seen: number[] = [];
    const dispose = store.subscribe((value) => seen.push(value.masterVolumePermille));
    expect(await store.load()).toEqual(DEFAULT_CLIENT_SETTINGS);
    expect(
      (await store.update({ masterVolumePermille: 333, colorVision: "tritanopia" }))
        .masterVolumePermille,
    ).toBe(333);
    expect(platform.requestedFrameRates).toEqual([60, 60]);
    expect(seen).toEqual([800, 800, 333]);
    dispose();
    await store.update({ masterVolumePermille: 222 });
    const restored = new SettingsStore(platform);
    expect((await restored.load()).masterVolumePermille).toBe(222);
  });

  it("survives malformed storage and provides redundant visual semantics", async () => {
    const platform = new MockPlatformAdapter();
    await platform.writeStorage("settings.v1", "{");
    expect(await new SettingsStore(platform).load()).toEqual(DEFAULT_CLIENT_SETTINGS);
    const enemy = factionSemantic("enemy", { ...DEFAULT_CLIENT_SETTINGS, highContrast: true });
    expect(enemy).toMatchObject({
      outline: "double",
      pattern: "crosshatch",
      iconKey: "icon.faction.enemy",
    });
    expect(buildValiditySemantic(false).textKey).toBe("build.invalid");
    expect(touchTargetSize(24, 1_000)).toBe(56);
    expect(touchTargetSize(60, 1_400)).toBe(84);
  });
});

describe("platform adapters and application lifecycle", () => {
  it("implements deterministic mock lifecycle, storage, network, login, and vibration", async () => {
    const platform = new MockPlatformAdapter();
    let foreground = 0;
    let background = 0;
    let network = "";
    const offForeground = platform.onForeground(() => (foreground += 1));
    platform.onBackground(() => (background += 1));
    platform.onNetworkChange((state) => {
      network = state.type;
    });
    platform.emitForeground();
    platform.emitBackground();
    platform.emitNetwork({ connected: false, type: "none" });
    offForeground();
    platform.emitForeground();
    await platform.writeStorage("a", "b");
    await platform.vibrate("medium");
    expect([foreground, background, network]).toEqual([1, 1, "none"]);
    expect(await platform.readStorage("a")).toBe("b");
    expect(await platform.requestLoginCode()).toBe("mock-login-code");
    expect(platform.getSafeArea().width).toBe(1280);
    expect(platform.vibrationLog).toEqual(["medium"]);
  });

  it("uses mock unless a WeChat API is detected", () => {
    expect(createDetectedPlatform({}).capabilities.kind).toBe("mock");
    expect(() => createDetectedPlatform(null)).not.toThrow();
  });

  it("bridges the narrow WeChat API without user profile fields", async () => {
    const show = new Set<() => void>();
    const hide = new Set<() => void>();
    const network = new Set<(value: { isConnected: boolean; networkType: string }) => void>();
    const api = {
      getSystemInfoSync: () => ({
        screenWidth: 1000,
        screenHeight: 500,
        safeArea: { left: 10, top: 20, right: 990, bottom: 480 },
      }),
      getNetworkType: ({ success }: { success: (value: { networkType: string }) => void }) => {
        success({ networkType: "4g" });
      },
      login: ({ success }: { success: (value: { code: string }) => void }) => {
        success({ code: "login-code" });
      },
      getStorage: ({
        key,
        success,
        fail,
      }: {
        key: string;
        success: (value: { data: unknown }) => void;
        fail: () => void;
      }) => {
        if (key === "found") success({ data: "value" });
        else fail();
      },
      setStorage: ({ success }: { success: () => void }) => {
        success();
      },
      vibrateShort: ({ complete }: { complete: () => void }) => {
        complete();
      },
      setPreferredFramesPerSecond: vi.fn(),
      onShow: (listener: () => void) => {
        show.add(listener);
      },
      offShow: (listener: () => void) => {
        show.delete(listener);
      },
      onHide: (listener: () => void) => {
        hide.add(listener);
      },
      offHide: (listener: () => void) => {
        hide.delete(listener);
      },
      onNetworkStatusChange: (
        listener: (value: { isConnected: boolean; networkType: string }) => void,
      ) => {
        network.add(listener);
      },
      offNetworkStatusChange: (
        listener: (value: { isConnected: boolean; networkType: string }) => void,
      ) => {
        network.delete(listener);
      },
    };
    const platform = new WechatPlatformAdapter(api);
    expect(platform.getSafeArea()).toEqual({
      left: 10,
      top: 20,
      right: 990,
      bottom: 480,
      width: 980,
      height: 460,
    });
    expect(await platform.getNetworkState()).toEqual({ connected: true, type: "cellular" });
    expect(await platform.requestLoginCode()).toBe("login-code");
    expect(await platform.readStorage("found")).toBe("value");
    expect(await platform.readStorage("missing")).toBeNull();
    await platform.writeStorage("x", "y");
    await platform.vibrate("light");
    platform.setPreferredFrameRate(30);
    const offShow = platform.onForeground(vi.fn());
    const offHide = platform.onBackground(vi.fn());
    const offNetwork = platform.onNetworkChange(vi.fn());
    offShow();
    offHide();
    offNetwork();
    expect(api.setPreferredFramesPerSecond).toHaveBeenCalledWith(30);
    expect(show.size + hide.size + network.size).toBe(0);
  });

  it("boots, reacts to background/network, and blocks portrait", async () => {
    const platform = new MockPlatformAdapter();
    const app = new ApplicationController(platform);
    expect((await app.start(1280, 720)).status).toBe("ready");
    platform.emitBackground();
    expect(
      app.audio?.play({
        id: "x",
        bus: "ui",
        critical: false,
        fallbackTextKey: null,
        fallbackIconKey: null,
      }),
    ).toBeNull();
    platform.emitForeground();
    platform.emitNetwork({ connected: false, type: "none" });
    expect(app.state().network.connected).toBe(false);
    app.stop();
    expect(app.state().status).toBe("stopped");
    expect(
      (await new ApplicationController(new MockPlatformAdapter()).start(600, 900)).status,
    ).toBe("blocked_orientation");
  });
});

describe("audio, localization, and async screens", () => {
  it("bounds and scales pooled audio with mandatory critical fallbacks", () => {
    const audio = new AudioDirector(
      { ...DEFAULT_CLIENT_SETTINGS, masterVolumePermille: 500, uiVolumePermille: 600 },
      2,
    );
    expect(
      audio.play({
        id: "ui",
        bus: "ui",
        critical: false,
        fallbackTextKey: null,
        fallbackIconKey: null,
      })?.volumePermille,
    ).toBe(300);
    expect(() =>
      audio.play({
        id: "bad",
        bus: "battle",
        critical: true,
        fallbackTextKey: null,
        fallbackIconKey: "i",
      }),
    ).toThrow(/fallbacks/);
    const second = audio.play({
      id: "music",
      bus: "music",
      critical: false,
      fallbackTextKey: null,
      fallbackIconKey: null,
    });
    expect(
      audio.play({
        id: "full",
        bus: "ambient",
        critical: false,
        fallbackTextKey: null,
        fallbackIconKey: null,
      }),
    ).toBeNull();
    audio.stop(second?.slot ?? -1);
    expect(audio.activeVoices()).toHaveLength(1);
    expect(() => new AudioDirector(DEFAULT_CLIENT_SETTINGS, 0)).toThrow(RangeError);
  });

  it("localizes keys and variables with visible missing-key fallback", () => {
    const localizer = new Localizer({ greet: "你好，{name}" });
    expect(localizer.text("greet", { name: "云桥" })).toBe("你好，云桥");
    expect(localizer.text("missing")).toBe("[missing]");
  });

  it("models ready, offline, and retryable error states without personal profiles", async () => {
    const menu = new MainMenuModel("系统-001");
    expect(
      (await menu.navigate("daily", { connected: false, type: "none" }, () => Promise.resolve()))
        .status,
    ).toBe("offline");
    expect(
      (
        await menu.navigate("expedition", { connected: false, type: "none" }, () =>
          Promise.resolve(),
        )
      ).status,
    ).toBe("ready");
    expect(
      (
        await menu.navigate("settings", { connected: true, type: "wifi" }, () =>
          Promise.reject(new Error("x")),
        )
      ).status,
    ).toBe("error");
    expect(menu.state().systemCodename).toBe("系统-001");
  });
});
