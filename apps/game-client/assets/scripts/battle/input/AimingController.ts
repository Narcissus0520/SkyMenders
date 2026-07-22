import { parseBattleCommand } from "@skymenders/protocol";
import type { UseModuleCommand } from "@skymenders/protocol";

export interface AimEnvelope {
  readonly commandId: string;
  readonly battleId: string;
  readonly turnIndex: number;
  readonly actorId: string;
  readonly moduleId: string;
  readonly originX: number;
  readonly originY: number;
}
export interface AimState {
  readonly angleMilliDegrees: number;
  readonly powerPermille: number;
  readonly targetX?: number;
  readonly targetY?: number;
  readonly targetId?: string;
  readonly status: "aiming" | "pending_confirmation";
}

export class AimingController {
  private stateValue: AimState = {
    angleMilliDegrees: 45_000,
    powerPermille: 500,
    status: "aiming",
  };
  constructor(
    private readonly envelope: AimEnvelope,
    private readonly sensitivityPermille = 1_000,
  ) {}
  state(): AimState {
    return this.stateValue;
  }

  drag(deltaX: number, deltaY: number): AimState {
    const angle = (Math.atan2(deltaY, deltaX) * 180_000) / Math.PI;
    const power = (Math.hypot(deltaX, deltaY) * this.sensitivityPermille) / 100;
    this.stateValue = {
      ...this.stateValue,
      angleMilliDegrees: normalizeAngle(Math.round(angle)),
      powerPermille: clamp(Math.round(power), 0, 1_000),
      status: "aiming",
    };
    return this.stateValue;
  }

  microAdjust(angleDeltaMilliDegrees: number, powerDeltaPermille: number): AimState {
    this.stateValue = {
      ...this.stateValue,
      angleMilliDegrees: normalizeAngle(
        this.stateValue.angleMilliDegrees + Math.round(angleDeltaMilliDegrees),
      ),
      powerPermille: clamp(
        this.stateValue.powerPermille + Math.round(powerDeltaPermille),
        0,
        1_000,
      ),
      status: "aiming",
    };
    return this.stateValue;
  }

  setPowerSlider(valuePermille: number): AimState {
    this.stateValue = {
      ...this.stateValue,
      powerPermille: clamp(Math.round(valuePermille), 0, 1_000),
      status: "aiming",
    };
    return this.stateValue;
  }

  setTarget(x: number, y: number, targetId?: string): AimState {
    this.stateValue = {
      ...this.stateValue,
      targetX: Math.round(x),
      targetY: Math.round(y),
      ...(targetId === undefined ? {} : { targetId }),
      status: "aiming",
    };
    return this.stateValue;
  }

  release(): AimState {
    this.stateValue = { ...this.stateValue, status: "pending_confirmation" };
    return this.stateValue;
  }
  cancelConfirmation(): AimState {
    this.stateValue = { ...this.stateValue, status: "aiming" };
    return this.stateValue;
  }

  confirm(): UseModuleCommand {
    if (this.stateValue.status !== "pending_confirmation")
      throw new Error("aim must be released before explicit confirmation");
    return parseBattleCommand({
      kind: "use_module",
      ...this.envelope,
      angleMilliDegrees: this.stateValue.angleMilliDegrees,
      powerPermille: this.stateValue.powerPermille,
      ...(this.stateValue.targetX === undefined
        ? {}
        : { targetX: this.stateValue.targetX, targetY: this.stateValue.targetY }),
      ...(this.stateValue.targetId === undefined ? {} : { targetId: this.stateValue.targetId }),
    }) as UseModuleCommand;
  }

  predictionFractionPermille(extended: boolean): number {
    return extended ? 1_000 : 500;
  }
}

function normalizeAngle(value: number): number {
  return ((value % 360_000) + 360_000) % 360_000;
}
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
