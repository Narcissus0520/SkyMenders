export const ROBOT_ANIMATION_STATES = [
  "idle",
  "move",
  "aim",
  "charge",
  "module",
  "hit",
  "knockback",
  "disabled",
  "recovery",
  "status",
] as const;
export type RobotAnimationState = (typeof ROBOT_ANIMATION_STATES)[number];
export interface RobotPose {
  readonly state: RobotAnimationState;
  readonly elapsedMs: number;
  readonly bobPixels: number;
  readonly tiltDegrees: number;
  readonly opacityPermille: number;
}

export class RobotAnimator {
  private stateValue: RobotAnimationState = "idle";
  private elapsedMs = 0;
  setState(state: RobotAnimationState): void {
    if (state !== this.stateValue) {
      this.stateValue = state;
      this.elapsedMs = 0;
    }
  }
  update(deltaMs: number, reducedMotion: boolean): RobotPose {
    this.elapsedMs += Math.max(0, Math.min(deltaMs, 100));
    const intensity = reducedMotion ? 0.2 : 1;
    const phase = this.elapsedMs / 240;
    const active =
      this.stateValue === "idle" || this.stateValue === "status" || this.stateValue === "charge";
    return {
      state: this.stateValue,
      elapsedMs: this.elapsedMs,
      bobPixels: active ? Math.sin(phase) * 2 * intensity : 0,
      tiltDegrees:
        this.stateValue === "hit"
          ? -8 * intensity
          : this.stateValue === "knockback"
            ? 12 * intensity
            : 0,
      opacityPermille: this.stateValue === "disabled" ? 550 : 1_000,
    };
  }
}
