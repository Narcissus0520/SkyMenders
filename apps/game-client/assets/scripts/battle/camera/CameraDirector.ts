export const CAMERA_MODES = [
  "overview",
  "follow_actor",
  "manual_inspect",
  "aiming",
  "projectile_follow",
  "objective_focus",
  "boss_mechanic_focus",
] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];

export interface CameraPose {
  readonly x: number;
  readonly y: number;
  readonly zoomPermille: number;
}
export interface CameraBounds {
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumY: number;
  readonly maximumY: number;
  readonly minimumZoomPermille: number;
  readonly maximumZoomPermille: number;
}
export interface CameraRequest {
  readonly id: string;
  readonly mode: CameraMode;
  readonly pose: CameraPose;
  readonly priority: number;
  readonly requestedAtMs: number;
}

export class CameraDirector {
  private poseValue: CameraPose;
  private modeValue: CameraMode = "overview";
  private manualUntilMs = 0;
  private readonly requests = new Map<string, CameraRequest>();

  constructor(
    private readonly bounds: CameraBounds,
    initial: CameraPose,
    private readonly manualHoldMs = 2_500,
  ) {
    this.poseValue = clampPose(initial, bounds);
  }

  pose(): CameraPose {
    return this.poseValue;
  }
  mode(): CameraMode {
    return this.modeValue;
  }

  manualPan(
    deltaX: number,
    deltaY: number,
    nowMs: number,
    sensitivityPermille = 1_000,
  ): CameraPose {
    this.manualUntilMs = nowMs + this.manualHoldMs;
    this.modeValue = "manual_inspect";
    this.poseValue = clampPose(
      {
        ...this.poseValue,
        x: this.poseValue.x + (deltaX * sensitivityPermille) / 1_000,
        y: this.poseValue.y + (deltaY * sensitivityPermille) / 1_000,
      },
      this.bounds,
    );
    return this.poseValue;
  }

  pinch(scale: number, nowMs: number): CameraPose {
    if (!Number.isFinite(scale) || scale <= 0)
      throw new RangeError("camera pinch scale must be positive");
    this.manualUntilMs = nowMs + this.manualHoldMs;
    this.modeValue = "manual_inspect";
    this.poseValue = clampPose(
      { ...this.poseValue, zoomPermille: Math.round(this.poseValue.zoomPermille * scale) },
      this.bounds,
    );
    return this.poseValue;
  }

  request(request: CameraRequest, nowMs: number): boolean {
    this.requests.set(request.id, request);
    if (nowMs < this.manualUntilMs && request.mode !== "boss_mechanic_focus") return false;
    const winner = Array.from(this.requests.values()).sort(
      (a, b) =>
        b.priority - a.priority || a.requestedAtMs - b.requestedAtMs || a.id.localeCompare(b.id),
    )[0];
    if (winner === undefined) return false;
    this.modeValue = winner.mode;
    this.poseValue = clampPose(winner.pose, this.bounds);
    return winner.id === request.id;
  }

  release(id: string): void {
    this.requests.delete(id);
  }

  shakeAmplitude(requested: number, reducedShake: boolean): number {
    return reducedShake ? 0 : Math.max(0, Math.min(requested, 12));
  }
}

function clampPose(pose: CameraPose, bounds: CameraBounds): CameraPose {
  return {
    x: clamp(pose.x, bounds.minimumX, bounds.maximumX),
    y: clamp(pose.y, bounds.minimumY, bounds.maximumY),
    zoomPermille: Math.round(
      clamp(pose.zoomPermille, bounds.minimumZoomPermille, bounds.maximumZoomPermille),
    ),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
