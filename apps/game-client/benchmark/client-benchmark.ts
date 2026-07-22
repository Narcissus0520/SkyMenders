import { performance } from "node:perf_hooks";

import { BattlePresentationStore } from "../assets/scripts/battle/presentation/BattlePresentationStore.js";
import { PerformanceMonitor } from "../assets/scripts/diagnostics/PerformanceMonitor.js";

const eventCount = 10_000;
const store = new BattlePresentationStore(256);
const monitor = new PerformanceMonitor(30, 600);
const startedAt = performance.now();

for (let sequence = 0; sequence < eventCount; sequence += 1) {
  store.consume({
    kind: "turn_waited",
    battleId: "benchmark",
    sequence,
    turnIndex: Math.floor(sequence / 3),
    commandId: `command:${sequence}`,
    actorId: `actor:${sequence % 6}`,
  });
  monitor.recordFrame(1_000 / 30);
}

const elapsedMs = performance.now() - startedAt;
if (elapsedMs > 1_000)
  throw new Error(`client presentation benchmark exceeded 1000 ms: ${elapsedMs.toFixed(2)} ms`);
if (!monitor.snapshot().withinBudget)
  throw new Error("synthetic 30 FPS telemetry did not remain inside budget");
process.stdout.write(
  `Client presentation benchmark: ${eventCount} events in ${elapsedMs.toFixed(2)} ms; queue=${store.snapshot().length}; synthetic target=30 FPS\n`,
);
