import { Button, Color, Graphics, Label, Node, UITransform } from "cc";
import type { Localizer } from "../../localization/Localizer";
import { LocalBattleController } from "./LocalBattleController";
import type { LocalBattleSnapshot } from "./LocalBattleController";

const CELL_SIZE = 22;
const GRID_LEFT = -440;
const GRID_BOTTOM = -62;
const CONTROL_Y = -178;

type BattleButtonTone = "adjust" | "primary" | "secondary" | "quiet";

const BUTTON_COLORS: Readonly<
  Record<BattleButtonTone, { readonly fill: Color; readonly stroke: Color; readonly text: Color }>
> = {
  adjust: {
    fill: new Color(32, 100, 122, 250),
    stroke: new Color(166, 231, 238, 255),
    text: new Color(236, 248, 246, 255),
  },
  primary: {
    fill: new Color(231, 169, 61, 255),
    stroke: new Color(255, 239, 154, 255),
    text: new Color(27, 54, 65, 255),
  },
  secondary: {
    fill: new Color(52, 135, 112, 255),
    stroke: new Color(166, 238, 211, 255),
    text: new Color(238, 252, 246, 255),
  },
  quiet: {
    fill: new Color(54, 75, 88, 250),
    stroke: new Color(150, 179, 190, 255),
    text: new Color(224, 237, 239, 255),
  },
};

const DISABLED_BUTTON_COLORS = {
  fill: new Color(55, 66, 73, 220),
  stroke: new Color(104, 123, 130, 220),
  text: new Color(146, 160, 164, 255),
} as const;

export class LocalBattleView {
  private root: Node | null = null;
  private readonly controller = new LocalBattleController();

  constructor(
    private readonly host: Node,
    private readonly localizer: Localizer,
    private readonly onExit: () => void,
    private readonly onFeedback: (kind: "light" | "medium") => void = () => undefined,
  ) {
    this.render();
  }

  destroy(): void {
    this.root?.destroy();
    this.root = null;
  }

  fireForTest(): LocalBattleSnapshot {
    this.controller.fire();
    this.render();
    return this.controller.snapshot();
  }

  endRoundForTest(): LocalBattleSnapshot {
    this.controller.endRound();
    this.render();
    return this.controller.snapshot();
  }

  adjustAimForTest(angleDelta: number, powerDelta: number): LocalBattleSnapshot {
    this.controller.adjustAngle(angleDelta);
    this.controller.adjustPower(powerDelta);
    this.render();
    return this.controller.snapshot();
  }

  snapshotForTest(): LocalBattleSnapshot {
    return this.controller.snapshot();
  }

  private render(): void {
    this.root?.destroy();
    const root = new Node("LocalBattle");
    root.layer = this.host.layer;
    root.parent = this.host;
    this.root = root;
    const snapshot = this.controller.snapshot();
    this.drawBackground(root);
    this.drawHud(root, snapshot);
    this.drawTerrain(root, snapshot);
    this.drawObjective(root, snapshot);
    this.drawActors(root, snapshot);
    this.drawAim(root, snapshot);
    this.drawControls(root, snapshot);
  }

  private drawBackground(root: Node): void {
    const layer = this.child(root, "Background");
    const graphics = layer.addComponent(Graphics);
    graphics.fillColor = new Color(18, 43, 62, 255);
    graphics.rect(-500, -220, 1_000, 440);
    graphics.fill();
    graphics.fillColor = new Color(40, 78, 97, 120);
    graphics.circle(-330, 125, 52);
    graphics.circle(315, 145, 70);
    graphics.fill();
  }

  private drawHud(root: Node, snapshot: LocalBattleSnapshot): void {
    const objective = snapshot.battle.objectives[0];
    this.addLabel(root, "BattleTitle", this.text("battle.local.title"), -320, 178, 30);
    this.addLabel(
      root,
      "Round",
      this.text("battle.local.round", {
        round: snapshot.battle.turnIndex + 1,
        phase: this.text(`phase.${snapshot.battle.phase}`),
      }),
      -350,
      145,
      18,
    );
    this.addLabel(
      root,
      "Energy",
      this.text("battle.local.energy", {
        current: snapshot.battle.energy.current,
        maximum: snapshot.battle.energy.maximum,
      }),
      180,
      178,
      21,
    );
    this.addLabel(
      root,
      "Objective",
      this.text("battle.local.objective", {
        progress: objective?.progress ?? 0,
        required: objective?.required ?? 3,
      }),
      180,
      145,
      18,
    );
    this.addLabel(
      root,
      "Message",
      this.text(snapshot.messageKey, this.localizeVariables(snapshot.messageVariables)),
      -285,
      112,
      17,
    );
  }

  private drawTerrain(root: Node, snapshot: LocalBattleSnapshot): void {
    const layer = this.child(root, "Terrain");
    const graphics = layer.addComponent(Graphics);
    const { terrain } = snapshot.battle;
    for (let y = 0; y < terrain.height; y += 1) {
      for (let x = 0; x < terrain.width; x += 1) {
        const index = y * terrain.width + x;
        const material = terrain.materials[index] ?? 0;
        const integrity = terrain.integrities[index] ?? 0;
        if (material === 0 || integrity <= 0) continue;
        graphics.fillColor = terrainColor(material, integrity);
        graphics.rect(
          GRID_LEFT + x * CELL_SIZE,
          GRID_BOTTOM + y * CELL_SIZE,
          CELL_SIZE + 1,
          CELL_SIZE + 1,
        );
        graphics.fill();
      }
    }
  }

  private drawObjective(root: Node, snapshot: LocalBattleSnapshot): void {
    const object = snapshot.battle.worldObjects.find((candidate) => candidate.active);
    if (object === undefined) return;
    const node = this.child(root, "EnergyCore");
    node.setPosition(gridX(object.x), gridY(object.y));
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(80, 233, 240, 255);
    graphics.circle(0, 0, 10);
    graphics.fill();
    graphics.strokeColor = new Color(225, 255, 250, 255);
    graphics.lineWidth = 2;
    graphics.circle(0, 0, 15);
    graphics.stroke();
  }

  private drawActors(root: Node, snapshot: LocalBattleSnapshot): void {
    for (const actor of snapshot.battle.actors) {
      const node = this.child(root, actor.id);
      node.setPosition(gridX(actor.x), gridY(actor.y));
      const graphics = node.addComponent(Graphics);
      const active = snapshot.activeActor?.id === actor.id;
      graphics.fillColor =
        actor.team === "player"
          ? new Color(75, 194, 208, actor.disabled ? 100 : 255)
          : new Color(231, 117, 88, actor.disabled ? 100 : 255);
      if (actor.team === "player") {
        graphics.roundRect(-11, -10, 22, 20, 7);
      } else {
        graphics.moveTo(0, 13);
        graphics.lineTo(13, 0);
        graphics.lineTo(0, -13);
        graphics.lineTo(-13, 0);
        graphics.lineTo(0, 13);
      }
      graphics.fill();
      graphics.strokeColor = active ? new Color(255, 238, 125, 255) : new Color(225, 250, 247, 255);
      graphics.lineWidth = active ? 4 : 2;
      graphics.circle(0, 0, active ? 17 : 14);
      graphics.stroke();
      this.addLabel(node, "ActorName", this.text(actorLabelKey(actor.id)), -24, 23, 13);
      this.addLabel(node, "ActorHp", this.text("battle.local.hp", { hp: actor.hp }), -20, -28, 11);
    }
  }

  private drawAim(root: Node, snapshot: LocalBattleSnapshot): void {
    const actor = snapshot.activeActor;
    const target = snapshot.target;
    if (actor === null || target === null) return;
    const layer = this.child(root, "Aim");
    const graphics = layer.addComponent(Graphics);
    const startX = gridX(actor.x);
    const startY = gridY(actor.y);
    const endX = gridX(target.x);
    const endY = gridY(target.y);
    graphics.strokeColor = new Color(255, 232, 120, 255);
    graphics.lineWidth = 3;
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.stroke();
    graphics.fillColor = new Color(255, 232, 120, 255);
    graphics.circle(endX, endY, 6);
    graphics.fill();
  }

  private drawControls(root: Node, snapshot: LocalBattleSnapshot): void {
    const canAim = snapshot.battle.outcome.status === "ongoing" && snapshot.activeActor !== null;
    const ongoing = snapshot.battle.outcome.status === "ongoing";
    this.addLabel(
      root,
      "AimReadout",
      this.text("battle.local.aim_readout", {
        angle: snapshot.angleDegrees,
        power: Math.round(snapshot.powerPermille / 10),
      }),
      -310,
      -137,
      18,
    );
    this.addButton(
      root,
      "AngleDown",
      this.text("battle.local.angle_down"),
      -405,
      CONTROL_Y,
      104,
      () => {
        this.controller.adjustAngle(-10);
        this.render();
      },
      "adjust",
      canAim,
    );
    this.addButton(
      root,
      "AngleUp",
      this.text("battle.local.angle_up"),
      -293,
      CONTROL_Y,
      104,
      () => {
        this.controller.adjustAngle(10);
        this.render();
      },
      "adjust",
      canAim,
    );
    this.addButton(
      root,
      "PowerDown",
      this.text("battle.local.power_down"),
      -181,
      CONTROL_Y,
      104,
      () => {
        this.controller.adjustPower(-100);
        this.render();
      },
      "adjust",
      canAim,
    );
    this.addButton(
      root,
      "PowerUp",
      this.text("battle.local.power_up"),
      -69,
      CONTROL_Y,
      104,
      () => {
        this.controller.adjustPower(100);
        this.render();
      },
      "adjust",
      canAim,
    );
    this.addButton(
      root,
      "Fire",
      this.text("battle.local.fire"),
      67,
      CONTROL_Y,
      152,
      () => {
        this.controller.fire();
        this.render();
      },
      "primary",
      canAim,
    );
    this.addButton(
      root,
      "EndRound",
      this.text("battle.local.end_round"),
      227,
      CONTROL_Y,
      152,
      () => {
        this.controller.endRound();
        this.render();
      },
      "secondary",
      ongoing,
    );
    this.addButton(
      root,
      "Exit",
      this.text("screen.back"),
      385,
      CONTROL_Y,
      148,
      this.onExit,
      "quiet",
    );
  }

  private addButton(
    parent: Node,
    name: string,
    label: string,
    x: number,
    y: number,
    width: number,
    onPress: () => void,
    tone: BattleButtonTone,
    enabled = true,
  ): void {
    const node = this.child(parent, name);
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, 66);
    const button = node.addComponent(Button);
    button.interactable = enabled;
    const colors = enabled ? BUTTON_COLORS[tone] : DISABLED_BUTTON_COLORS;
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = colors.fill;
    graphics.strokeColor = colors.stroke;
    graphics.lineWidth = tone === "primary" && enabled ? 3 : 2;
    graphics.roundRect(-width / 2, -28, width, 56, 16);
    graphics.fill();
    graphics.stroke();
    const buttonLabel = this.addLabel(node, "Label", label, 0, -10, tone === "primary" ? 18 : 16);
    buttonLabel.color = colors.text;
    if (!enabled) return;
    node.on(
      Node.EventType.TOUCH_START,
      () => {
        node.setScale(0.94, 0.94, 1);
      },
      this,
    );
    node.on(
      Node.EventType.TOUCH_CANCEL,
      () => {
        node.setScale(1, 1, 1);
      },
      this,
    );
    node.on(
      Node.EventType.TOUCH_END,
      () => {
        node.setScale(1, 1, 1);
        this.onFeedback(tone === "primary" ? "medium" : "light");
        onPress();
      },
      this,
    );
  }

  private addLabel(
    parent: Node,
    name: string,
    value: string,
    x: number,
    y: number,
    size: number,
  ): Label {
    const node = this.child(parent, name);
    node.setPosition(x, y);
    const label = node.addComponent(Label);
    label.string = value;
    label.fontSize = size;
    label.lineHeight = Math.ceil(size * 1.25);
    label.color = new Color(236, 248, 246, 255);
    return label;
  }

  private child(parent: Node, name: string): Node {
    const node = new Node(name);
    node.layer = this.host.layer;
    node.parent = parent;
    return node;
  }

  private text(key: string, variables: Readonly<Record<string, string | number>> = {}): string {
    return this.localizer.text(key, variables);
  }

  private localizeVariables(
    variables: Readonly<Record<string, string | number>>,
  ): Readonly<Record<string, string | number>> {
    return Object.fromEntries(
      Object.entries(variables).map(([key, value]) => [
        key,
        typeof value === "string" && value.startsWith("battle.") ? this.text(value) : value,
      ]),
    );
  }
}

function gridX(x: number): number {
  return GRID_LEFT + x * CELL_SIZE + CELL_SIZE / 2;
}

function gridY(y: number): number {
  return GRID_BOTTOM + y * CELL_SIZE + CELL_SIZE / 2;
}

function terrainColor(material: number, integrity: number): Color {
  const alpha = Math.max(100, Math.min(255, 80 + Math.round(integrity / 5)));
  switch (material) {
    case 2:
      return new Color(92, 121, 137, alpha);
    case 3:
      return new Color(70, 211, 222, alpha);
    case 4:
      return new Color(112, 186, 142, alpha);
    default:
      return new Color(151, 130, 100, alpha);
  }
}

function actorLabelKey(actorId: string): string {
  return `battle.actor.${actorId.replace(":", ".")}`;
}
