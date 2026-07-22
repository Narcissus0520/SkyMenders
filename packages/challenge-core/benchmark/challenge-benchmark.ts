import { performance } from "node:perf_hooks";

import { createDailyChallenge } from "../src/index.js";
import { loadPack } from "../test/fixture.js";

const pack = loadPack();
const started = performance.now();
for (let day = 1; day <= 500; day += 1) {
  createDailyChallenge(pack, {
    instant: new Date(Date.UTC(2026, 0, day)),
    timeZone: "Asia/Shanghai",
    seedSecret: "benchmark-daily-challenge-secret-32-bytes",
    rulesVersion: "0.5.0",
    contentVersion: "0.1.0",
  });
}
const elapsed = performance.now() - started;
if (elapsed > 5_000) throw new Error(`daily challenge benchmark exceeded 5000 ms: ${elapsed}`);
process.stdout.write(`daily challenge benchmark: 500 definitions in ${elapsed.toFixed(2)} ms\n`);
