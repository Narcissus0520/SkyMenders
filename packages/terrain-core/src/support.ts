import { getTerrainMaterial } from "./materials.js";
import { assertTerrainState, chunkKey, compareChunks, terrainIndex, terrainPoint } from "./grid.js";
import { TERRAIN_CHUNK_SIZE } from "./types.js";
import type {
  ChunkCoordinate,
  SupportAnalysisScope,
  TerrainState,
  TerrainSupportAnalysis,
} from "./types.js";

interface SupportCandidate {
  readonly index: number;
  readonly remaining: number;
}

export interface AnalyzeTerrainSupportOptions {
  readonly scope?: SupportAnalysisScope;
  readonly dirtyChunks?: readonly ChunkCoordinate[];
}

export function analyzeTerrainSupport(
  state: TerrainState,
  options: AnalyzeTerrainSupportOptions = {},
): TerrainSupportAnalysis {
  assertTerrainState(state);
  const scope = options.scope ?? "dirty_components";
  const affected =
    scope === "full"
      ? allOccupiedCells(state)
      : occupiedComponentsTouchingChunks(state, options.dirtyChunks ?? state.dirtyChunks);
  const remainingSupport = new Int32Array(state.materials.length);
  remainingSupport.fill(-1);
  const queue = new MaxSupportHeap();

  for (const root of state.supportRoots) {
    const index = terrainIndex(state.width, root.x, root.y);
    if (affected[index] !== 1 || root.capacity <= (remainingSupport[index] ?? -1)) continue;
    remainingSupport[index] = root.capacity;
    queue.push({ index, remaining: root.capacity });
  }

  for (;;) {
    const current = queue.pop();
    if (current === undefined) break;
    if (remainingSupport[current.index] !== current.remaining) continue;
    for (const neighbor of neighborIndices(state, current.index)) {
      if (affected[neighbor] !== 1) continue;
      const materialCode = state.materials[neighbor];
      if (materialCode === undefined || materialCode === 0) continue;
      const traversalCost = 1_001 - getTerrainMaterial(materialCode).supportPermille;
      const candidate = current.remaining - traversalCost;
      if (candidate < 0 || candidate <= (remainingSupport[neighbor] ?? -1)) continue;
      remainingSupport[neighbor] = candidate;
      queue.push({ index: neighbor, remaining: candidate });
    }
  }

  const supportedCellIndices: number[] = [];
  const unstableMask = new Uint8Array(state.materials.length);
  for (let index = 0; index < state.materials.length; index += 1) {
    if (affected[index] !== 1 || state.materials[index] === 0) continue;
    if ((remainingSupport[index] ?? -1) >= 0) supportedCellIndices.push(index);
    else unstableMask[index] = 1;
  }

  const unstableComponents = collectComponents(state, unstableMask);
  return {
    scope,
    supportedCellIndices,
    unstableComponents,
    inspectedCellCount: countMask(affected),
    inspectedChunks: chunksForMask(state, affected),
  };
}

function allOccupiedCells(state: TerrainState): Uint8Array {
  const affected = new Uint8Array(state.materials.length);
  for (let index = 0; index < state.materials.length; index += 1) {
    if (state.materials[index] !== 0) affected[index] = 1;
  }
  return affected;
}

function occupiedComponentsTouchingChunks(
  state: TerrainState,
  chunks: readonly ChunkCoordinate[],
): Uint8Array {
  const affected = new Uint8Array(state.materials.length);
  if (chunks.length === 0) return affected;
  const queued = new Uint8Array(state.materials.length);
  const queue: number[] = [];

  for (const chunk of [...chunks].sort(compareChunks)) {
    const minimumX = Math.max(0, chunk.x * TERRAIN_CHUNK_SIZE - 1);
    const maximumX = Math.min(state.width - 1, (chunk.x + 1) * TERRAIN_CHUNK_SIZE);
    const minimumY = Math.max(0, chunk.y * TERRAIN_CHUNK_SIZE - 1);
    const maximumY = Math.min(state.height - 1, (chunk.y + 1) * TERRAIN_CHUNK_SIZE);
    for (let y = minimumY; y <= maximumY; y += 1) {
      for (let x = minimumX; x <= maximumX; x += 1) {
        const index = terrainIndex(state.width, x, y);
        if (state.materials[index] === 0 || queued[index] === 1) continue;
        queued[index] = 1;
        queue.push(index);
      }
    }
  }

  let cursor = 0;
  while (cursor < queue.length) {
    const index = queue[cursor];
    cursor += 1;
    if (index === undefined) continue;
    affected[index] = 1;
    for (const neighbor of neighborIndices(state, index)) {
      if (state.materials[neighbor] === 0 || queued[neighbor] === 1) continue;
      queued[neighbor] = 1;
      queue.push(neighbor);
    }
  }
  return affected;
}

function collectComponents(state: TerrainState, mask: Uint8Array): number[][] {
  const visited = new Uint8Array(mask.length);
  const components: number[][] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || visited[start] === 1) continue;
    const component: number[] = [];
    const queue = [start];
    visited[start] = 1;
    let cursor = 0;
    while (cursor < queue.length) {
      const index = queue[cursor];
      cursor += 1;
      if (index === undefined) continue;
      component.push(index);
      for (const neighbor of neighborIndices(state, index)) {
        if (mask[neighbor] !== 1 || visited[neighbor] === 1) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
    component.sort((left, right) => left - right);
    components.push(component);
  }
  components.sort((left, right) => (left[0] ?? 0) - (right[0] ?? 0));
  return components;
}

function neighborIndices(state: TerrainState, index: number): number[] {
  const { x, y } = terrainPoint(state.width, index);
  const neighbors: number[] = [];
  if (y > 0) neighbors.push(terrainIndex(state.width, x, y - 1));
  if (x > 0) neighbors.push(terrainIndex(state.width, x - 1, y));
  if (x + 1 < state.width) neighbors.push(terrainIndex(state.width, x + 1, y));
  if (y + 1 < state.height) neighbors.push(terrainIndex(state.width, x, y + 1));
  return neighbors;
}

function chunksForMask(state: TerrainState, mask: Uint8Array): ChunkCoordinate[] {
  const chunks = new Map<string, ChunkCoordinate>();
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const point = terrainPoint(state.width, index);
    const chunk = {
      x: Math.floor(point.x / TERRAIN_CHUNK_SIZE),
      y: Math.floor(point.y / TERRAIN_CHUNK_SIZE),
    };
    chunks.set(chunkKey(chunk), chunk);
  }
  return [...chunks.values()].sort(compareChunks);
}

function countMask(mask: Uint8Array): number {
  let count = 0;
  for (const value of mask) count += value;
  return count;
}

class MaxSupportHeap {
  readonly #values: SupportCandidate[] = [];

  push(value: SupportCandidate): void {
    this.#values.push(value);
    let index = this.#values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const parentValue = this.#values[parent];
      if (parentValue === undefined || !comesBefore(value, parentValue)) break;
      this.#values[index] = parentValue;
      index = parent;
    }
    this.#values[index] = value;
  }

  pop(): SupportCandidate | undefined {
    const first = this.#values[0];
    const last = this.#values.pop();
    if (first === undefined || last === undefined || this.#values.length === 0) return first;

    let index = 0;
    for (;;) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      const left = this.#values[leftIndex];
      const right = this.#values[rightIndex];
      if (left === undefined) break;
      const preferred = right !== undefined && comesBefore(right, left) ? right : left;
      const preferredIndex = preferred === right ? rightIndex : leftIndex;
      if (!comesBefore(preferred, last)) break;
      this.#values[index] = preferred;
      index = preferredIndex;
    }
    this.#values[index] = last;
    return first;
  }
}

function comesBefore(left: SupportCandidate, right: SupportCandidate): boolean {
  return (
    left.remaining > right.remaining ||
    (left.remaining === right.remaining && left.index < right.index)
  );
}
