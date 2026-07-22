import { executeAiEnemyPhase } from "../src/index.js";
import { aiFixture } from "../test/fixtures.js";

const scenarios = [
  { bossId: "boss_rift_drill" as const },
  { bossId: "boss_polar_magnetic_tower" as const },
  { bossId: "boss_inverted_controller" as const },
  { bossId: "boss_unbound_island_mainframe" as const },
  { prototypeId: "enemy_driller" as const },
  { prototypeId: "enemy_magnet" as const },
  { prototypeId: "enemy_repairer" as const },
  { prototypeId: "enemy_wind" as const },
];
const samples: number[] = [];
let decisionCount = 0;

for (let run = 0; run < 9; run += 1) {
  const fixture = aiFixture(scenarios, "expert", 0xb055_0000 + run);
  const start = performance.now();
  const result = executeAiEnemyPhase(fixture.battle, fixture.ai, 1_000);
  const elapsed = performance.now() - start;
  if (run > 0) samples.push(elapsed);
  decisionCount = result.commands.length;
}

samples.sort((left, right) => left - right);
const median = percentile(samples, 0.5);
const p95 = percentile(samples, 0.95);
const budget = 1_500;
if (p95 > budget) {
  throw new Error(`AI benchmark p95 ${p95.toFixed(2)} ms exceeds ${budget} ms budget`);
}
process.stdout.write(
  `AI benchmark: ${scenarios.length} actors, ${decisionCount} legal decisions, median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms\n`,
);

function percentile(values: readonly number[], ratio: number): number {
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1));
  const value = values[index];
  if (value === undefined) throw new Error("AI benchmark requires samples");
  return value;
}
