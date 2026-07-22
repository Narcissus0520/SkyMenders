export const RNG_STREAMS = [
  "map",
  "enemy",
  "ai",
  "aim_error",
  "reward",
  "fault",
  "event",
  "hidden_objective",
] as const;

export type RngStreamName = (typeof RNG_STREAMS)[number];
export type RngState = readonly [number, number, number, number];

export interface RngResult<T> {
  readonly value: T;
  readonly state: RngState;
}

const UINT32_RANGE = 0x1_0000_0000;

export function createRngState(seed: number): RngState {
  assertUint32(seed, "seed");
  let cursor = seed >>> 0;
  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const result = splitMix32(cursor);
    cursor = result.state;
    values.push(result.value);
  }
  const state = values as unknown as RngState;
  return state.every((value) => value === 0) ? [0x9e37_79b9, 0x243f_6a88, 0xb7e1_5163, 1] : state;
}

export function deriveRngState(rootSeed: number, stream: RngStreamName): RngState {
  assertUint32(rootSeed, "root seed");
  let derived = (0x811c_9dc5 ^ rootSeed) >>> 0;
  for (let index = 0; index < stream.length; index += 1) {
    derived ^= stream.charCodeAt(index);
    derived = Math.imul(derived, 0x0100_0193) >>> 0;
  }
  return createRngState(derived);
}

export function nextUint32(state: RngState): RngResult<number> {
  validateRngState(state);
  const [state0, state1, state2, state3] = state;
  const result = Math.imul(rotateLeft(Math.imul(state1, 5) >>> 0, 7), 9) >>> 0;
  const temporary = (state1 << 9) >>> 0;

  let next2 = (state2 ^ state0) >>> 0;
  let next3 = (state3 ^ state1) >>> 0;
  const next1 = (state1 ^ next2) >>> 0;
  const next0 = (state0 ^ next3) >>> 0;
  next2 = (next2 ^ temporary) >>> 0;
  next3 = rotateLeft(next3, 11);

  return { value: result, state: [next0, next1, next2, next3] };
}

export function nextInteger(state: RngState, minimum: number, maximum: number): RngResult<number> {
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum > maximum) {
    throw new RangeError("random integer bounds must be ordered safe integers");
  }
  const span = maximum - minimum + 1;
  if (!Number.isSafeInteger(span) || span <= 0 || span > UINT32_RANGE) {
    throw new RangeError("random integer span must be between 1 and 2^32");
  }

  const limit = Math.floor(UINT32_RANGE / span) * span;
  let cursor = state;
  for (;;) {
    const next = nextUint32(cursor);
    cursor = next.state;
    if (next.value < limit) {
      return { value: minimum + (next.value % span), state: cursor };
    }
  }
}

export function validateRngState(state: RngState): void {
  const values: readonly number[] = state;
  if (values.length !== 4) {
    throw new RangeError("RNG state must contain exactly four uint32 values");
  }
  values.forEach((value) => {
    assertUint32(value, "RNG state value");
  });
  if (values.every((value) => value === 0)) {
    throw new RangeError("RNG state cannot be all zero");
  }
}

function splitMix32(state: number): { readonly value: number; readonly state: number } {
  const nextState = (state + 0x9e37_79b9) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 16), 0x21f0_aaad) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x735a_2d97) >>> 0;
  return { value: (value ^ (value >>> 15)) >>> 0, state: nextState };
}

function rotateLeft(value: number, count: number): number {
  return ((value << count) | (value >>> (32 - count))) >>> 0;
}

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(`${label} must be a uint32`);
  }
}
