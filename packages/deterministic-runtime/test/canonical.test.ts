import { describe, expect, it } from "vitest";

import { canonicalClone, canonicalStringify, hashCanonical, hashUtf8 } from "../src/index.js";

describe("canonical serialization and hashing", () => {
  it("sorts object keys recursively while preserving array order", () => {
    const left = { z: [3, { beta: true, alpha: "天空" }], a: -0, n: null };
    const right = { n: null, a: 0, z: [3, { alpha: "天空", beta: true }] };
    expect(canonicalStringify(left)).toBe('{"a":0,"n":null,"z":[3,{"alpha":"天空","beta":true}]}');
    expect(canonicalStringify(right)).toBe(canonicalStringify(left));
    expect(hashCanonical(right)).toBe(hashCanonical(left));
    expect(hashCanonical(right)).toMatch(/^[0-9a-f]{16}$/);
    expect(canonicalClone(left)).toEqual(right);
  });

  it("hashes UTF-8 text consistently", () => {
    expect(hashUtf8("SkyMenders/浮岛")).toBe("6c6b8abc28342c68");
    expect(hashUtf8("SkyMenders/浮岛")).toBe(hashUtf8("SkyMenders/浮岛"));
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, undefined, 1n, Symbol("x"), () => 1])(
    "rejects unsupported value %s",
    (value) => {
      expect(() => canonicalStringify(value)).toThrow();
    },
  );

  it("rejects cycles and non-plain objects", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalStringify(cyclic)).toThrow("cycle");
    expect(() => canonicalStringify(new Date(0))).toThrow("Object or null prototypes");
    const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
      b: 2,
      a: 1,
    });
    expect(canonicalStringify(nullPrototype)).toBe('{"a":1,"b":2}');
  });

  it("rejects sparse arrays rather than producing invalid JSON", () => {
    const sparse = new Array<unknown>(2);
    sparse[1] = "present";
    expect(() => canonicalStringify(sparse)).toThrow("cannot be sparse");
  });

  it("enforces depth and node budgets", () => {
    let deep: unknown = null;
    for (let index = 0; index < 130; index += 1) deep = [deep];
    expect(() => canonicalStringify(deep)).toThrow("depth");
    expect(() => canonicalStringify(Array.from({ length: 100_001 }, () => null))).toThrow("nodes");
  });
});
