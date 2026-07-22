import { executeLargeCollapseScenario } from "./large-collapse-scenario.js";

const WARMUP_RUNS = 3;
const MEASURED_RUNS = 15;
const P95_BUDGET_MILLISECONDS = 100;

for (let index = 0; index < WARMUP_RUNS; index += 1) executeLargeCollapseScenario();

const samples: number[] = [];
let inspectedCells = 0;
let collapseCells = 0;
for (let index = 0; index < MEASURED_RUNS; index += 1) {
  const start = process.hrtime.bigint();
  const scenario = executeLargeCollapseScenario();
  const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
  samples.push(elapsed);
  inspectedCells = scenario.analysis.inspectedCellCount;
  collapseCells = scenario.analysis.unstableComponents.reduce(
    (total, component) => total + component.length,
    0,
  );
}

samples.sort((left, right) => left - right);
const percentileIndex = Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1);
const p95 = samples[percentileIndex];
const median = samples[Math.floor(samples.length / 2)];
if (p95 === undefined || median === undefined)
  throw new Error("terrain benchmark produced no samples");

process.stdout.write(
  `terrain benchmark: ${collapseCells} collapse cells, ${inspectedCells} inspected cells, ` +
    `median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms\n`,
);

if (p95 > P95_BUDGET_MILLISECONDS) {
  throw new Error(
    `terrain collapse p95 ${p95.toFixed(2)} ms exceeds ${P95_BUDGET_MILLISECONDS} ms budget`,
  );
}
