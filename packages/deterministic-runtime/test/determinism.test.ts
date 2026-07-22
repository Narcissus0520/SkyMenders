import { describe, expect, it } from "vitest";

import { canonicalStringify, deriveRngState, hashCanonical, nextUint32 } from "../src/index.js";

describe("cross-run determinism invariants", () => {
  it("repeats identical canonical hashes and random sequences", () => {
    const run = () => {
      let state = deriveRngState(0xdead_beef, "ai");
      const values: number[] = [];
      for (let index = 0; index < 1_000; index += 1) {
        const next = nextUint32(state);
        state = next.state;
        values.push(next.value);
      }
      return {
        serialized: canonicalStringify({ values, state }),
        hash: hashCanonical({ values, state }),
      };
    };
    expect(run()).toEqual(run());
  });

  it("adding calls to one substream cannot alter another", () => {
    let map = deriveRngState(123, "map");
    const reward = deriveRngState(123, "reward");
    const rewardBefore = nextUint32(reward);
    for (let index = 0; index < 100; index += 1) map = nextUint32(map).state;
    const rewardAfter = nextUint32(reward);
    expect(rewardAfter).toEqual(rewardBefore);
  });
});
