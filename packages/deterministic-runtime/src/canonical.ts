export type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

const MAX_DEPTH = 128;
const MAX_NODES = 100_000;

export function canonicalStringify(value: unknown): string {
  const active = new WeakSet<object>();
  const counter = { nodes: 0 };
  return serialize(value, 0, active, counter);
}

export function canonicalClone<T extends CanonicalValue>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

function serialize(
  value: unknown,
  depth: number,
  active: WeakSet<object>,
  counter: { nodes: number },
): string {
  counter.nodes += 1;
  if (counter.nodes > MAX_NODES) {
    throw new RangeError(`canonical value exceeds ${MAX_NODES} nodes`);
  }
  if (depth > MAX_DEPTH) {
    throw new RangeError(`canonical value exceeds depth ${MAX_DEPTH}`);
  }

  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("canonical numbers must be safe integers");
    }
    return Object.is(value, -0) ? "0" : String(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`unsupported canonical value type: ${typeof value}`);
  }
  if (active.has(value)) {
    throw new TypeError("canonical value contains a cycle");
  }

  active.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new TypeError("canonical arrays cannot be sparse");
        }
      }
      return `[${value.map((entry) => serialize(entry, depth + 1, active, counter)).join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("canonical objects must use Object or null prototypes");
    }
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort(compareCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${serialize(record[key], depth + 1, active, counter)}`);
    return `{${entries.join(",")}}`;
  } finally {
    active.delete(value);
  }
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
