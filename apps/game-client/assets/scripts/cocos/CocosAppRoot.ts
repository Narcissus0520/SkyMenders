import {
  _decorator,
  assetManager,
  Button,
  Color,
  Component,
  game,
  Graphics,
  Label,
  macro,
  Node,
  UITransform,
  view,
} from "cc";
import { LocalBattleView } from "../battle/local/LocalBattleView";
import { ApplicationController } from "../bootstrap/ApplicationController";
import { createDetectedPlatform } from "../platform/wechat/WechatPlatformAdapter";
import type { MainRoute } from "../ui/MainMenuModel";

const { ccclass } = _decorator;
const DEVTOOLS_BRIDGE_KEY = "__SKYMENDERS_DEVTOOLS_TEST__";

interface DevtoolsTestBridge {
  openLocalBattle(): void;
  fire(): unknown;
  endRound(): unknown;
  adjustAim(angleDelta: number, powerDelta: number): unknown;
  snapshot(): unknown;
  backToMenu(): void;
}

type DevtoolsGlobal = typeof globalThis & {
  wx?: {
    getSystemInfoSync?: () => { platform?: string };
  };
  __SKYMENDERS_DEVTOOLS_TEST__?: DevtoolsTestBridge;
};

@ccclass("CocosAppRoot")
export class CocosAppRoot extends Component {
  private application: ApplicationController | null = null;
  private titleLabel: Label | null = null;
  private statusLabel: Label | null = null;
  private readonly menuButtons: Node[] = [];
  private backButton: Node | null = null;
  private battleView: LocalBattleView | null = null;

  start(): void {
    view.setOrientation(macro.ORIENTATION_LANDSCAPE);
    game.frameRate = 60;
    void this.boot();
  }

  onDestroy(): void {
    const globals = globalThis as DevtoolsGlobal;
    delete globals.__SKYMENDERS_DEVTOOLS_TEST__;
    this.application?.stop();
  }

  private async boot(): Promise<void> {
    this.application = new ApplicationController(createDetectedPlatform());
    const safe = this.application.platform.getSafeArea();
    const state = await this.application.start(safe.width, safe.height);
    this.renderShell(state.status === "ready" ? "app.title" : (state.messageKey ?? "screen.error"));
    this.installDevtoolsTestBridge();
  }

  private renderShell(titleKey: string): void {
    if (this.application === null) return;
    const rootTransform =
      this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    rootTransform.setContentSize(1280, 720);
    const background = this.node.addComponent(Graphics);
    background.fillColor = new Color(24, 47, 66, 255);
    background.rect(-640, -360, 1280, 720);
    background.fill();
    this.titleLabel = this.addLabel("Title", this.application.localizer.text(titleKey), 0, 150, 42);
    this.statusLabel = this.addLabel(
      "Status",
      this.application.localizer.text("screen.choose_route"),
      0,
      -155,
      22,
    );
    const entries = [
      ["menu.expedition", "expedition", -330, 50],
      ["menu.daily", "daily", -110, 50],
      ["menu.collection", "collection", 110, 50],
      ["menu.settings", "settings", 330, 50],
      ["menu.privacy", "privacy", -110, -70],
      ["menu.user_agreement", "user_agreement", 110, -70],
    ] as const;
    for (const [key, route, x, y] of entries)
      this.menuButtons.push(
        this.addButton(key, x, y, () => {
          void this.application?.platform.vibrate("light");
          void this.navigate(route);
        }),
      );
    this.backButton = this.addButton("screen.back", 0, -110, () => {
      this.showMainMenu();
    });
    this.backButton.active = false;
  }

  private addButton(key: string, x: number, y: number, onPress: () => void): Node {
    if (this.application === null) throw new Error("application is not initialized");
    const button = new Node(key);
    button.layer = this.node.layer;
    button.parent = this.node;
    button.setPosition(x, y);
    const transform = button.addComponent(UITransform);
    transform.setContentSize(190, 72);
    button.addComponent(Button);
    const graphics = button.addComponent(Graphics);
    graphics.fillColor = new Color(38, 101, 122, 255);
    graphics.strokeColor = new Color(166, 231, 238, 255);
    graphics.lineWidth = 3;
    graphics.roundRect(-95, -36, 190, 72, 18);
    graphics.fill();
    graphics.stroke();
    this.addLabelTo(button, this.application.localizer.text(key), 0, -12, 24);
    button.on(
      Node.EventType.TOUCH_START,
      () => {
        button.setScale(0.96, 0.96, 1);
      },
      this,
    );
    button.on(
      Node.EventType.TOUCH_CANCEL,
      () => {
        button.setScale(1, 1, 1);
      },
      this,
    );
    button.on(
      Node.EventType.TOUCH_END,
      () => {
        button.setScale(1, 1, 1);
        onPress();
      },
      this,
    );
    return button;
  }

  private addLabel(name: string, value: string, x: number, y: number, size: number): Label {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.parent = this.node;
    node.setPosition(x, y);
    return this.styleLabel(node, value, size);
  }

  private addLabelTo(node: Node, value: string, x: number, y: number, size: number): void {
    const labelNode = new Node("Label");
    labelNode.layer = node.layer;
    labelNode.parent = node;
    labelNode.setPosition(x, y);
    this.styleLabel(labelNode, value, size);
  }

  private styleLabel(node: Node, value: string, size: number): Label {
    const label = node.addComponent(Label);
    label.string = value;
    label.fontSize = size;
    label.lineHeight = Math.ceil(size * 1.25);
    label.color = new Color(238, 248, 246, 255);
    return label;
  }

  private async navigate(route: MainRoute): Promise<void> {
    if (this.application === null) return;
    const routeName = this.application.localizer.text(`menu.${route}`);
    this.setStatus("screen.opening_route", { name: routeName });
    const network = await this.application.platform.getNetworkState();
    const state = await this.application.menu.navigate(route, network, () =>
      route === "collection" ? loadFeatureBundle("feature-collection") : Promise.resolve(),
    );
    if (state.status !== "ready") {
      this.setStatus(state.messageKey ?? "screen.error");
      return;
    }
    if (route === "expedition") {
      this.showLocalBattle();
      return;
    }
    for (const button of this.menuButtons) button.active = false;
    if (this.backButton !== null) this.backButton.active = true;
    if (this.titleLabel !== null) this.titleLabel.string = routeName;
    if (this.statusLabel !== null) this.statusLabel.node.setPosition(0, 0);
    this.setStatus("screen.route_ready", { name: routeName });
  }

  private showMainMenu(): void {
    if (this.application === null) return;
    this.battleView?.destroy();
    this.battleView = null;
    for (const button of this.menuButtons) button.active = true;
    if (this.backButton !== null) this.backButton.active = false;
    if (this.titleLabel !== null) {
      this.titleLabel.node.active = true;
      this.titleLabel.string = this.application.localizer.text("app.title");
    }
    if (this.statusLabel !== null) {
      this.statusLabel.node.active = true;
      this.statusLabel.node.setPosition(0, -155);
    }
    this.setStatus("screen.choose_route");
  }

  private showLocalBattle(): void {
    if (this.application === null) return;
    for (const button of this.menuButtons) button.active = false;
    if (this.backButton !== null) this.backButton.active = false;
    if (this.titleLabel !== null) this.titleLabel.node.active = false;
    if (this.statusLabel !== null) this.statusLabel.node.active = false;
    this.battleView?.destroy();
    this.battleView = new LocalBattleView(
      this.node,
      this.application.localizer,
      () => {
        this.showMainMenu();
      },
      (kind) => {
        if (this.application?.settings.current().vibration === true)
          void this.application.platform.vibrate(kind);
      },
    );
  }

  private installDevtoolsTestBridge(): void {
    const globals = globalThis as DevtoolsGlobal;
    let platform: string | undefined;
    try {
      platform = globals.wx?.getSystemInfoSync?.().platform;
    } catch {
      return;
    }
    if (platform !== "devtools") return;
    globals[DEVTOOLS_BRIDGE_KEY] = {
      openLocalBattle: () => {
        this.showLocalBattle();
      },
      fire: () => this.battleView?.fireForTest() ?? null,
      endRound: () => this.battleView?.endRoundForTest() ?? null,
      adjustAim: (angleDelta, powerDelta) =>
        this.battleView?.adjustAimForTest(angleDelta, powerDelta) ?? null,
      snapshot: () => this.battleView?.snapshotForTest() ?? null,
      backToMenu: () => {
        this.showMainMenu();
      },
    };
  }

  private setStatus(key: string, variables: Readonly<Record<string, string>> = {}): void {
    if (this.application !== null && this.statusLabel !== null)
      this.statusLabel.string = this.application.localizer.text(key, variables);
  }
}

function loadFeatureBundle(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    assetManager.loadBundle(name, (error) => {
      if (error === null) resolve();
      else reject(error);
    });
  });
}
