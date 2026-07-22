import { canonicalStringify } from "./canonical.js";

const encoder = new TextEncoder();

export function hashCanonical(value: unknown): string {
  return hashUtf8(canonicalStringify(value));
}

export function hashUtf8(value: string): string {
  const bytes = encoder.encode(value);
  const first = fnv1a32(bytes, 0x811c_9dc5);
  const second = fnv1a32(bytes, 0x9e37_79b9);
  return `${toHex(first)}${toHex(second)}`;
}

function fnv1a32(bytes: Uint8Array, seed: number): number {
  let hash = seed >>> 0;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x0100_0193) >>> 0;
  }
  return hash;
}

function toHex(value: number): string {
  return value.toString(16).padStart(8, "0");
}
