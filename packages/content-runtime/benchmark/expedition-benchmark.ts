import { performance } from "node:perf_hooks";

import { generateExpeditionPlan } from "../src/index.js";

import { loadPack } from "../test/fixture.js";

const pack = loadPack();
const iterations = 5_000;
const started = performance.now();
let nodes = 0;
for (let seed = 0; seed < iterations; seed += 1) {
  const plan = generateExpeditionPlan(pack, seed);
  nodes += plan.regions.reduce((sum, region) => sum + region.layers.flat().length, 0);
}
const elapsed = performance.now() - started;
if (elapsed > 5_000)
  throw new Error(`expedition generation exceeded 5000 ms: ${elapsed.toFixed(2)} ms`);
process.stdout.write(
  `expedition benchmark: ${iterations} plans, ${nodes} nodes in ${elapsed.toFixed(2)} ms\n`,
);
