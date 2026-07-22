import type { ClientSettings } from "../../settings/settings.js";

export interface EffectRequest {
  readonly particles: number;
  readonly debris: number;
  readonly flashPermille: number;
  readonly shake: number;
}
export interface EffectAllocation {
  readonly particles: number;
  readonly debris: number;
  readonly flashPermille: number;
  readonly shake: number;
}

export class EffectBudget {
  constructor(
    readonly maximumParticles = 180,
    readonly maximumDebris = 24,
  ) {}
  allocate(request: EffectRequest, settings: ClientSettings): EffectAllocation {
    return {
      particles: Math.min(
        Math.max(0, request.particles),
        settings.reducedMotion ? Math.floor(this.maximumParticles / 3) : this.maximumParticles,
      ),
      debris: Math.min(
        Math.max(0, request.debris),
        settings.reducedMotion ? 4 : this.maximumDebris,
      ),
      flashPermille: settings.reducedFlash
        ? Math.min(150, Math.max(0, request.flashPermille))
        : Math.min(1_000, Math.max(0, request.flashPermille)),
      shake: settings.reducedShake ? 0 : Math.min(12, Math.max(0, request.shake)),
    };
  }
}
