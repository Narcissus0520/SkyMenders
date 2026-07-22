import type { ClientSettings } from "../settings/settings.js";

export interface VisualSemantic {
  readonly color: string;
  readonly outline: "solid" | "double" | "dashed";
  readonly pattern: "plain" | "diagonal" | "dots" | "crosshatch";
  readonly iconKey: string;
  readonly textKey: string;
}

const PALETTES = {
  standard: ["#5CC8FF", "#FF7C70", "#F6D365"],
  deuteranopia: ["#4CB4FF", "#F2A65A", "#EBD76B"],
  protanopia: ["#4DB8FF", "#F0B05A", "#D9D270"],
  tritanopia: ["#54C5A8", "#F07888", "#FFB05A"],
} as const;

export function factionSemantic(
  faction: "player" | "enemy" | "neutral",
  settings: ClientSettings,
): VisualSemantic {
  const index = faction === "player" ? 0 : faction === "enemy" ? 1 : 2;
  const color = settings.highContrast
    ? (["#00E5FF", "#FF3D68", "#FFF000"][index] ?? "#FFFFFF")
    : PALETTES[settings.colorVision][index];
  return {
    color,
    outline: faction === "player" ? "solid" : faction === "enemy" ? "double" : "dashed",
    pattern: faction === "player" ? "diagonal" : faction === "enemy" ? "crosshatch" : "dots",
    iconKey: `icon.faction.${faction}`,
    textKey: `faction.${faction}`,
  };
}

export function buildValiditySemantic(valid: boolean): VisualSemantic {
  return valid
    ? {
        color: "#4DD68A",
        outline: "solid",
        pattern: "diagonal",
        iconKey: "icon.valid",
        textKey: "build.valid",
      }
    : {
        color: "#FF6B7A",
        outline: "double",
        pattern: "crosshatch",
        iconKey: "icon.invalid",
        textKey: "build.invalid",
      };
}

export function touchTargetSize(visualSize: number, textScalePermille: number): number {
  return Math.max(56, Math.ceil(visualSize * Math.max(1, textScalePermille / 1_000)));
}
