import {
  _decorator,
  assetManager,
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
import { ApplicationController } from "../bootstrap/ApplicationController.js";
import { createDetectedPlatform } from "../platform/wechat/WechatPlatformAdapter.js";
import type { MainRoute } from "../ui/MainMenuModel.js";

const { ccclass } = _decorator;

@ccclass("CocosAppRoot")
export class CocosAppRoot extends Component {
  private application: ApplicationController | null = null;
  private statusLabel: Label | null = null;

  start(): void {
    view.setOrientation(macro.ORIENTATION_LANDSCAPE);
    game.frameRate = 60;
    void this.boot();
  }

  onDestroy(): void {
    this.application?.stop();
  }

  private async boot(): Promise<void> {
    this.application = new ApplicationController(createDetectedPlatform());
    const safe = this.application.platform.getSafeArea();
    const state = await this.application.start(safe.width, safe.height);
    this.renderShell(state.status === "ready" ? "app.title" : (state.messageKey ?? "screen.error"));
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
    this.addLabel("Title", this.application.localizer.text(titleKey), 0, 250, 42);
    this.statusLabel = this.addLabel("Status", "", 0, 175, 22);
    const entries = [
      ["menu.expedition", "expedition", -330],
      ["menu.daily", "daily", -110],
      ["menu.collection", "collection", 110],
      ["menu.settings", "settings", 330],
    ] as const;
    for (const [key, route, x] of entries) this.addButton(key, route, x, 50);
  }

  private addButton(key: string, route: MainRoute, x: number, y: number): void {
    if (this.application === null) return;
    const button = new Node(key);
    button.parent = this.node;
    button.setPosition(x, y);
    const transform = button.addComponent(UITransform);
    transform.setContentSize(190, 72);
    const graphics = button.addComponent(Graphics);
    graphics.fillColor = new Color(38, 101, 122, 255);
    graphics.strokeColor = new Color(166, 231, 238, 255);
    graphics.lineWidth = 3;
    graphics.roundRect(-95, -36, 190, 72, 18);
    graphics.fill();
    graphics.stroke();
    this.addLabelTo(button, this.application.localizer.text(key), 0, -12, 24);
    button.on(
      Node.EventType.TOUCH_END,
      () => {
        void this.application?.platform.vibrate("light");
        void this.navigate(route);
      },
      this,
    );
  }

  private addLabel(name: string, value: string, x: number, y: number, size: number): Label {
    const node = new Node(name);
    node.parent = this.node;
    node.setPosition(x, y);
    return this.styleLabel(node, value, size);
  }

  private addLabelTo(node: Node, value: string, x: number, y: number, size: number): void {
    const labelNode = new Node("Label");
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
    const network = await this.application.platform.getNetworkState();
    const state = await this.application.menu.navigate(route, network, () =>
      route === "collection" ? loadFeatureBundle("feature-collection") : Promise.resolve(),
    );
    if (this.statusLabel !== null) {
      this.statusLabel.string = this.application.localizer.text(
        state.messageKey ?? `menu.${route}`,
      );
    }
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
