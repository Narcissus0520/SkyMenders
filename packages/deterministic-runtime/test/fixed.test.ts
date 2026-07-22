import { describe, expect, it } from "vitest";

import {
  FIXED_SCALE,
  FIXED_ZERO,
  absoluteFixed,
  addFixed,
  clampFixed,
  cosMilliDegrees,
  divideFixed,
  fixedFromInteger,
  fixedFromRaw,
  fixedToIntegerTowardZero,
  multiplyFixed,
  normalizeAngle,
  sinMilliDegrees,
  subtractFixed,
} from "../src/index.js";

describe("fixed-point math", () => {
  it("uses a scale of 1000 and explicit toward-zero arithmetic", () => {
    expect(FIXED_SCALE).toBe(1_000);
    expect(FIXED_ZERO).toBe(0);
    expect(fixedFromInteger(3)).toBe(3_000);
    expect(fixedToIntegerTowardZero(fixedFromRaw(-1_999))).toBe(-1);
    expect(addFixed(fixedFromRaw(1_250), fixedFromRaw(750))).toBe(2_000);
    expect(subtractFixed(fixedFromRaw(1_250), fixedFromRaw(2_000))).toBe(-750);
    expect(multiplyFixed(fixedFromRaw(-1_500), fixedFromRaw(1_501))).toBe(-2_251);
    expect(divideFixed(fixedFromRaw(-5_000), fixedFromRaw(2_000))).toBe(-2_500);
    expect(absoluteFixed(fixedFromRaw(-7_000))).toBe(7_000);
  });

  it("clamps inclusively and rejects an inverted range", () => {
    expect(clampFixed(fixedFromRaw(-5), fixedFromRaw(0), fixedFromRaw(10))).toBe(0);
    expect(clampFixed(fixedFromRaw(5), fixedFromRaw(0), fixedFromRaw(10))).toBe(5);
    expect(clampFixed(fixedFromRaw(15), fixedFromRaw(0), fixedFromRaw(10))).toBe(10);
    expect(() => clampFixed(fixedFromRaw(0), fixedFromRaw(1), fixedFromRaw(0))).toThrow(
      "minimum exceeds maximum",
    );
  });

  it("rejects unsafe numbers, overflow, and division by zero", () => {
    expect(() => fixedFromRaw(1.5)).toThrow("safe integer");
    expect(() => fixedFromInteger(Number.MAX_SAFE_INTEGER)).toThrow("safe integer");
    expect(() => addFixed(fixedFromRaw(Number.MAX_SAFE_INTEGER), fixedFromRaw(1))).toThrow(
      "safe integer",
    );
    expect(() => multiplyFixed(fixedFromRaw(Number.MAX_SAFE_INTEGER), fixedFromRaw(2))).toThrow(
      "safe integer",
    );
    expect(() => divideFixed(fixedFromRaw(1), FIXED_ZERO)).toThrow("division by zero");
  });
});

describe("integer trigonometry lookup", () => {
  it.each([
    [0, 0, 1_000],
    [30_000, 500, 866],
    [45_000, 707, 707],
    [90_000, 1_000, 0],
    [180_000, 0, -1_000],
    [270_000, -1_000, 0],
    [360_000, 0, 1_000],
  ])("resolves %i milli-degrees", (angle, sine, cosine) => {
    expect(sinMilliDegrees(angle)).toBe(sine);
    expect(cosMilliDegrees(angle)).toBe(cosine);
  });

  it("normalizes negative/multiple rotations and interpolates between table entries", () => {
    expect(normalizeAngle(-90_000)).toBe(270_000);
    expect(normalizeAngle(720_001)).toBe(1);
    expect(sinMilliDegrees(30_500)).toBeGreaterThan(sinMilliDegrees(30_000));
    expect(sinMilliDegrees(30_500)).toBeLessThan(sinMilliDegrees(31_000));
    expect(sinMilliDegrees(-30_000)).toBe(-500);
  });

  it("rejects non-integer and unsafe angles", () => {
    expect(() => normalizeAngle(0.5)).toThrow("safe integer");
    expect(() => cosMilliDegrees(Number.MAX_VALUE)).toThrow("safe integer");
  });
});
