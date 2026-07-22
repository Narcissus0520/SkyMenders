declare const FIXED_BRAND: unique symbol;

export type Fixed = number & { readonly [FIXED_BRAND]: "Fixed" };

export const FIXED_SCALE = 1_000;
export const FIXED_ZERO = 0 as Fixed;

export function fixedFromRaw(value: number): Fixed {
  assertSafeInteger(value, "fixed value");
  return (Object.is(value, -0) ? 0 : value) as Fixed;
}

export function fixedFromInteger(value: number): Fixed {
  assertSafeInteger(value, "integer value");
  return fixedFromRaw(safeMultiply(value, FIXED_SCALE, "fixed conversion"));
}

export function fixedToIntegerTowardZero(value: Fixed): number {
  return Math.trunc(value / FIXED_SCALE);
}

export function addFixed(left: Fixed, right: Fixed): Fixed {
  return fixedFromRaw(safeAdd(left, right, "fixed addition"));
}

export function subtractFixed(left: Fixed, right: Fixed): Fixed {
  return fixedFromRaw(safeAdd(left, Number(right) * -1, "fixed subtraction"));
}

export function multiplyFixed(left: Fixed, right: Fixed): Fixed {
  const product = safeMultiply(left, right, "fixed multiplication");
  return fixedFromRaw(Math.trunc(product / FIXED_SCALE));
}

export function divideFixed(dividend: Fixed, divisor: Fixed): Fixed {
  if (divisor === 0) {
    throw new RangeError("fixed division by zero");
  }
  const numerator = safeMultiply(dividend, FIXED_SCALE, "fixed division");
  return fixedFromRaw(Math.trunc(numerator / divisor));
}

export function clampFixed(value: Fixed, minimum: Fixed, maximum: Fixed): Fixed {
  if (minimum > maximum) {
    throw new RangeError("fixed clamp minimum exceeds maximum");
  }
  return fixedFromRaw(Math.min(maximum, Math.max(minimum, value)));
}

export function absoluteFixed(value: Fixed): Fixed {
  return fixedFromRaw(Math.abs(value));
}

export function assertSafeInteger(value: number, label: string): asserts value is number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function safeAdd(left: number, right: number, label: string): number {
  const result = left + right;
  assertSafeInteger(result, label);
  return result;
}

function safeMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  assertSafeInteger(result, label);
  return result;
}
