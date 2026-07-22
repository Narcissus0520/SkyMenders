export type GestureOwner = "aim" | "ui" | "camera";
export interface GestureHit {
  readonly onAimHandle: boolean;
  readonly onUi: boolean;
  readonly touchCount: number;
}

export function routeGesture(hit: GestureHit): GestureOwner {
  if (hit.onAimHandle) return "aim";
  if (hit.onUi) return "ui";
  return "camera";
}

export function isPinchGesture(hit: GestureHit): boolean {
  return hit.touchCount >= 2 && !hit.onAimHandle && !hit.onUi;
}
