import { describe, expect, it } from "vitest";

import {
  RNG_STREAMS,
  createRngState,
  deriveRngState,
  nextInteger,
  nextUint32,
  validateRngState,
} from "../src/index.js";

describe("xoshiro128** RNG", () => {
  it("produces a stable uint32 sequence", () => {
    let state = createRngState(0x1234_5678);
    const values: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const next = nextUint32(state);
      state = next.state;
      values.push(next.value);
    }
    expect(values).toEqual([
      1_878_818_782, 786_455_212, 462_225_631, 2_155_212_579, 411_377_898, 3_167_696_138,
    ]);
  });

  it("derives isolated named streams", () => {
    expect(RNG_STREAMS).toHaveLength(8);
    const rootSeed = 42;
    const mapFirst = nextUint32(deriveRngState(rootSeed, "map"));
    const mapSecond = nextUint32(mapFirst.state);
    const rewardFirst = nextUint32(deriveRngState(rootSeed, "reward"));
    expect(mapFirst.value).not.toBe(rewardFirst.value);
    expect(nextUint32(deriveRngState(rootSeed, "map")).value).toBe(mapFirst.value);
    expect(nextUint32(mapFirst.state).value).toBe(mapSecond.value);
  });

  it("samples ordered inclusive bounds without modulo bias", () => {
    const initial = createRngState(7);
    const fixed = nextInteger(initial, 5, 5);
    expect(fixed.value).toBe(5);
    const ranged = nextInteger(fixed.state, -3, 3);
    expect(ranged.value).toBeGreaterThanOrEqual(-3);
    expect(ranged.value).toBeLessThanOrEqual(3);
    const full = nextInteger(ranged.state, 0, 0xffff_ffff);
    expect(full.value).toBeGreaterThanOrEqual(0);
  });

  it("rejects invalid seeds, states, and ranges", () => {
    expect(() => createRngState(-1)).toThrow("uint32");
    expect(() => createRngState(0x1_0000_0000)).toThrow("uint32");
    expect(() => {
      validateRngState([0, 0, 0, 0]);
    }).toThrow("all zero");
    expect(() => {
      validateRngState([1, 2, 3] as never);
    }).toThrow("exactly four");
    expect(() => {
      validateRngState([1, 2, 3, -1]);
    }).toThrow("uint32");
    expect(() => nextInteger(createRngState(1), 2, 1)).toThrow("ordered safe integers");
    expect(() => nextInteger(createRngState(1), 0, 0x1_0000_0000)).toThrow("span");
  });
});
