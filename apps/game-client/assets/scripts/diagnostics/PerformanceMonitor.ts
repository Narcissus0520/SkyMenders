export interface PerformanceSnapshot {
  readonly sampleCount: number;
  readonly averageFps: number;
  readonly p95FrameMs: number;
  readonly longTaskCount: number;
  readonly targetFps: 30 | 60;
  readonly withinBudget: boolean;
}
export class PerformanceMonitor {
  private readonly frames: number[] = [];
  private longTasks = 0;
  constructor(
    readonly targetFps: 30 | 60,
    readonly maximumSamples = 600,
  ) {}
  recordFrame(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.frames.push(deltaMs);
    if (deltaMs > 100) this.longTasks += 1;
    while (this.frames.length > this.maximumSamples) this.frames.shift();
  }
  snapshot(): PerformanceSnapshot {
    if (this.frames.length === 0)
      return {
        sampleCount: 0,
        averageFps: 0,
        p95FrameMs: 0,
        longTaskCount: this.longTasks,
        targetFps: this.targetFps,
        withinBudget: false,
      };
    const sorted = [...this.frames].sort((a, b) => a - b);
    const average = this.frames.reduce((sum, value) => sum + value, 0) / this.frames.length;
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
    const threshold = (1_000 / this.targetFps) * 1.25;
    return {
      sampleCount: this.frames.length,
      averageFps: 1_000 / average,
      p95FrameMs: p95,
      longTaskCount: this.longTasks,
      targetFps: this.targetFps,
      withinBudget: p95 <= threshold && this.longTasks === 0,
    };
  }
}
