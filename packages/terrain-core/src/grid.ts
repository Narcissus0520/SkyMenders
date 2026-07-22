import { getTerrainMaterial, materialCodeToId, materialIdToCode } from "./materials.js";
import type { TerrainMaterialCode } from "./materials.js";
import {
  TERRAIN_CHUNK_SIZE,
  TERRAIN_MAX_CELLS,
  TERRAIN_MAX_INTEGRITY,
  TERRAIN_SCHEMA_VERSION,
} from "./types.js";
import type {
  ChunkCoordinate,
  GridPoint,
  TerrainCell,
  TerrainDamageCommand,
  TerrainDamageResult,
  TerrainFill,
  TerrainRepairCommand,
  TerrainRepairResult,
  TerrainState,
  TerrainSupportRoot,
} from "./types.js";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const MAX_SUPPORT_CAPACITY = 100_000;

export interface CreateTerrainStateInput {
  readonly width: number;
  readonly height: number;
  readonly fills?: readonly TerrainFill[];
  readonly supportRoots?: readonly TerrainSupportRoot[];
}

export function createTerrainState(input: CreateTerrainStateInput): TerrainState {
  assertDimensions(input.width, input.height);
  const length = input.width * input.height;
  const materials = Array<TerrainMaterialCode>(length).fill(0);
  const integrities = Array<number>(length).fill(0);

  for (const fill of input.fills ?? []) {
    assertRectangle(fill, input.width, input.height);
    const integrity = fill.integrity ?? TERRAIN_MAX_INTEGRITY;
    assertIntegrity(integrity, "fill integrity");
    if (integrity === 0) {
      throw new RangeError("terrain fill integrity must be positive");
    }
    const materialCode = materialIdToCode(fill.materialId);
    for (let y = fill.y; y < fill.y + fill.height; y += 1) {
      for (let x = fill.x; x < fill.x + fill.width; x += 1) {
        const index = terrainIndex(input.width, x, y);
        if (materials[index] !== 0) {
          throw new RangeError(`terrain fills overlap at ${x},${y}`);
        }
        materials[index] = materialCode;
        integrities[index] = integrity;
      }
    }
  }

  const state: TerrainState = {
    terrainSchemaVersion: TERRAIN_SCHEMA_VERSION,
    width: input.width,
    height: input.height,
    chunkSize: TERRAIN_CHUNK_SIZE,
    materials,
    integrities,
    supportRoots: [...(input.supportRoots ?? [])].sort(compareSupportRoots),
    dirtyChunks: allChunkCoordinates(input.width, input.height),
    revision: 0,
  };
  assertTerrainState(state);
  for (const root of state.supportRoots) {
    if (state.materials[terrainIndex(state.width, root.x, root.y)] === 0) {
      throw new RangeError(`support root ${root.id} must attach to occupied terrain`);
    }
  }
  return state;
}

export function assertTerrainState(state: TerrainState): void {
  if (state.terrainSchemaVersion !== TERRAIN_SCHEMA_VERSION) {
    throw new Error(`unsupported terrain schema: ${state.terrainSchemaVersion}`);
  }
  assertDimensions(state.width, state.height);
  if (state.chunkSize !== TERRAIN_CHUNK_SIZE) {
    throw new RangeError(`terrain chunk size must be ${TERRAIN_CHUNK_SIZE}`);
  }
  const expectedLength = state.width * state.height;
  if (state.materials.length !== expectedLength || state.integrities.length !== expectedLength) {
    throw new RangeError("terrain material and integrity arrays must match dimensions");
  }
  for (let index = 0; index < expectedLength; index += 1) {
    const material = state.materials[index];
    const integrity = state.integrities[index];
    if (material === undefined || !isTerrainMaterialCode(material)) {
      throw new RangeError(`invalid terrain material code at index ${index}`);
    }
    if (integrity === undefined) {
      throw new RangeError(`missing terrain integrity at index ${index}`);
    }
    assertIntegrity(integrity, `terrain integrity at index ${index}`);
    if ((material === 0) !== (integrity === 0)) {
      throw new RangeError(`empty material and zero integrity must agree at index ${index}`);
    }
  }
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) {
    throw new RangeError("terrain revision must be a non-negative safe integer");
  }

  const rootIds = new Set<string>();
  for (const root of state.supportRoots) {
    assertPointInBounds(state, root.x, root.y, "support root");
    if (!IDENTIFIER_PATTERN.test(root.id) || root.id.length > 128 || rootIds.has(root.id)) {
      throw new RangeError(`invalid or duplicate support root id: ${root.id}`);
    }
    rootIds.add(root.id);
    if (root.kind !== "fixed_anchor" && root.kind !== "support_structure") {
      throw new RangeError(`invalid support root kind: ${root.kind}`);
    }
    if (
      !Number.isSafeInteger(root.capacity) ||
      root.capacity <= 0 ||
      root.capacity > MAX_SUPPORT_CAPACITY
    ) {
      throw new RangeError("support root capacity must be between 1 and 100000");
    }
  }

  const dirtyKeys = new Set<string>();
  for (const chunk of state.dirtyChunks) {
    assertChunkInBounds(state, chunk);
    const key = chunkKey(chunk);
    if (dirtyKeys.has(key)) {
      throw new RangeError(`duplicate dirty chunk: ${key}`);
    }
    dirtyKeys.add(key);
  }
}

export function terrainIndex(width: number, x: number, y: number): number {
  return y * width + x;
}

export function terrainPoint(
  width: number,
  index: number,
): { readonly x: number; readonly y: number } {
  return { x: index % width, y: Math.floor(index / width) };
}

export function isTerrainPointInBounds(state: TerrainState, x: number, y: number): boolean {
  return (
    Number.isSafeInteger(x) &&
    Number.isSafeInteger(y) &&
    x >= 0 &&
    x < state.width &&
    y >= 0 &&
    y < state.height
  );
}

export function getTerrainCell(state: TerrainState, x: number, y: number): TerrainCell | null {
  assertPointInBounds(state, x, y, "terrain cell");
  const index = terrainIndex(state.width, x, y);
  const material = state.materials[index];
  const integrity = state.integrities[index];
  if (material === undefined || integrity === undefined) {
    throw new RangeError("terrain cell index is missing");
  }
  return material === 0 ? null : { materialId: materialCodeToId(material), integrity };
}

export function applyTerrainDamage(
  state: TerrainState,
  command: TerrainDamageCommand,
): TerrainDamageResult {
  assertTerrainState(state);
  assertPointInBounds(state, command.x, command.y, "damage center");
  if (!Number.isSafeInteger(command.radius) || command.radius < 0 || command.radius > 64) {
    throw new RangeError("terrain damage radius must be an integer between 0 and 64");
  }
  if (!Number.isSafeInteger(command.energy) || command.energy <= 0 || command.energy > 10_000) {
    throw new RangeError("terrain damage energy must be an integer between 1 and 10000");
  }

  const materials = [...state.materials];
  const integrities = [...state.integrities];
  const affectedCells: TerrainDamageResult["affectedCells"][number][] = [];
  const effects: TerrainDamageResult["effects"][number][] = [];
  const dirty = dirtyChunkMap(state.dirtyChunks);
  const radiusSquared = command.radius * command.radius;
  const minimumX = Math.max(0, command.x - command.radius);
  const maximumX = Math.min(state.width - 1, command.x + command.radius);
  const minimumY = Math.max(0, command.y - command.radius);
  const maximumY = Math.min(state.height - 1, command.y + command.radius);

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const deltaX = x - command.x;
      const deltaY = y - command.y;
      if (deltaX * deltaX + deltaY * deltaY > radiusSquared) continue;
      const index = terrainIndex(state.width, x, y);
      const materialCode = materials[index];
      const integrityBefore = integrities[index];
      if (materialCode === undefined || integrityBefore === undefined || materialCode === 0)
        continue;

      const material = getTerrainMaterial(materialCode);
      const damage = Math.max(
        1,
        Math.trunc((command.energy * (1_100 - material.hardnessPermille)) / 1_000),
      );
      const integrityAfter = Math.max(0, integrityBefore - damage);
      if (integrityAfter === integrityBefore) continue;
      const destroyed = integrityAfter === 0;
      integrities[index] = integrityAfter;
      if (destroyed) materials[index] = 0;
      markCellAndSeamsDirty(state, x, y, dirty);
      affectedCells.push({
        x,
        y,
        materialId: material.id,
        integrityBefore,
        integrityAfter,
        destroyed,
      });
      if (destroyed && material.energyReleasePermille > 0) {
        effects.push({
          x,
          y,
          kind: "energy_release",
          amount: Math.trunc((command.energy * material.energyReleasePermille) / 1_000),
        });
      }
    }
  }

  return {
    state:
      affectedCells.length === 0
        ? state
        : {
            ...state,
            materials,
            integrities,
            dirtyChunks: sortedChunks(dirty.values()),
            revision: state.revision + 1,
          },
    affectedCells,
    effects,
  };
}

export function applyTerrainRepair(
  state: TerrainState,
  command: TerrainRepairCommand,
): TerrainRepairResult {
  assertTerrainState(state);
  assertPointInBounds(state, command.x, command.y, "repair target");
  if (!Number.isSafeInteger(command.amount) || command.amount <= 0 || command.amount > 1_000) {
    throw new RangeError("terrain repair amount must be an integer between 1 and 1000");
  }
  if (!Number.isSafeInteger(command.availableEnergy) || command.availableEnergy < 0) {
    throw new RangeError("available repair energy must be a non-negative safe integer");
  }

  const index = terrainIndex(state.width, command.x, command.y);
  const existingCode = state.materials[index];
  const integrityBefore = state.integrities[index];
  if (existingCode === undefined || integrityBefore === undefined) {
    throw new RangeError("repair target index is missing");
  }
  const materialCode = materialIdToCode(command.materialId);
  if (existingCode !== 0 && existingCode !== materialCode) {
    throw new Error("terrain repair cannot replace a different material");
  }
  const repairedIntegrity = Math.min(command.amount, TERRAIN_MAX_INTEGRITY - integrityBefore);
  if (repairedIntegrity === 0) return { state, repairedIntegrity: 0, energySpent: 0 };
  const material = getTerrainMaterial(command.materialId);
  const energySpent = Math.ceil((repairedIntegrity * material.repairCostPermille) / 1_000);
  if (energySpent > command.availableEnergy) {
    throw new Error(`insufficient repair energy: requires ${energySpent}`);
  }

  const materials = [...state.materials];
  const integrities = [...state.integrities];
  materials[index] = materialCode;
  integrities[index] = integrityBefore + repairedIntegrity;
  const dirty = dirtyChunkMap(state.dirtyChunks);
  markCellAndSeamsDirty(state, command.x, command.y, dirty);
  return {
    state: {
      ...state,
      materials,
      integrities,
      dirtyChunks: sortedChunks(dirty.values()),
      revision: state.revision + 1,
    },
    repairedIntegrity,
    energySpent,
  };
}

export function clearTerrainDirtyChunks(state: TerrainState): TerrainState {
  return state.dirtyChunks.length === 0 ? state : { ...state, dirtyChunks: [] };
}

export function terrainDirtyChunksForCells(
  state: TerrainState,
  points: readonly GridPoint[],
  existing: readonly ChunkCoordinate[] = state.dirtyChunks,
): ChunkCoordinate[] {
  const dirty = dirtyChunkMap(existing);
  for (const point of points) {
    assertPointInBounds(state, point.x, point.y, "dirty terrain point");
    markCellAndSeamsDirty(state, point.x, point.y, dirty);
  }
  return sortedChunks(dirty.values());
}

export function chunkKey(chunk: ChunkCoordinate): string {
  return `${chunk.x}:${chunk.y}`;
}

export function compareChunks(left: ChunkCoordinate, right: ChunkCoordinate): number {
  return left.y - right.y || left.x - right.x;
}

function assertDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError("terrain dimensions must be positive safe integers");
  }
  const cells = width * height;
  if (!Number.isSafeInteger(cells) || cells > TERRAIN_MAX_CELLS) {
    throw new RangeError(`terrain cannot exceed ${TERRAIN_MAX_CELLS} cells`);
  }
}

function assertRectangle(fill: TerrainFill, width: number, height: number): void {
  if (
    !Number.isSafeInteger(fill.x) ||
    !Number.isSafeInteger(fill.y) ||
    !Number.isSafeInteger(fill.width) ||
    !Number.isSafeInteger(fill.height) ||
    fill.x < 0 ||
    fill.y < 0 ||
    fill.width <= 0 ||
    fill.height <= 0 ||
    fill.x + fill.width > width ||
    fill.y + fill.height > height
  ) {
    throw new RangeError("terrain fill rectangle must be positive and inside the grid");
  }
}

function assertIntegrity(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > TERRAIN_MAX_INTEGRITY) {
    throw new RangeError(`${label} must be between 0 and ${TERRAIN_MAX_INTEGRITY}`);
  }
}

function assertPointInBounds(state: TerrainState, x: number, y: number, label: string): void {
  if (!isTerrainPointInBounds(state, x, y)) {
    throw new RangeError(`${label} must be an integer point inside terrain bounds`);
  }
}

function assertChunkInBounds(state: TerrainState, chunk: ChunkCoordinate): void {
  const chunkColumns = Math.ceil(state.width / TERRAIN_CHUNK_SIZE);
  const chunkRows = Math.ceil(state.height / TERRAIN_CHUNK_SIZE);
  if (
    !Number.isSafeInteger(chunk.x) ||
    !Number.isSafeInteger(chunk.y) ||
    chunk.x < 0 ||
    chunk.y < 0 ||
    chunk.x >= chunkColumns ||
    chunk.y >= chunkRows
  ) {
    throw new RangeError("dirty chunk must be inside terrain chunk bounds");
  }
}

function allChunkCoordinates(width: number, height: number): ChunkCoordinate[] {
  const chunks: ChunkCoordinate[] = [];
  for (let y = 0; y < Math.ceil(height / TERRAIN_CHUNK_SIZE); y += 1) {
    for (let x = 0; x < Math.ceil(width / TERRAIN_CHUNK_SIZE); x += 1) chunks.push({ x, y });
  }
  return chunks;
}

function dirtyChunkMap(chunks: readonly ChunkCoordinate[]): Map<string, ChunkCoordinate> {
  return new Map(chunks.map((chunk) => [chunkKey(chunk), chunk]));
}

function markCellAndSeamsDirty(
  state: TerrainState,
  x: number,
  y: number,
  dirty: Map<string, ChunkCoordinate>,
): void {
  const chunkX = Math.floor(x / TERRAIN_CHUNK_SIZE);
  const chunkY = Math.floor(y / TERRAIN_CHUNK_SIZE);
  const offsetsX = [0];
  const offsetsY = [0];
  if (x % TERRAIN_CHUNK_SIZE === 0) offsetsX.push(-1);
  if (x % TERRAIN_CHUNK_SIZE === TERRAIN_CHUNK_SIZE - 1) offsetsX.push(1);
  if (y % TERRAIN_CHUNK_SIZE === 0) offsetsY.push(-1);
  if (y % TERRAIN_CHUNK_SIZE === TERRAIN_CHUNK_SIZE - 1) offsetsY.push(1);
  const maximumChunkX = Math.ceil(state.width / TERRAIN_CHUNK_SIZE) - 1;
  const maximumChunkY = Math.ceil(state.height / TERRAIN_CHUNK_SIZE) - 1;
  for (const offsetY of offsetsY) {
    for (const offsetX of offsetsX) {
      const chunk = { x: chunkX + offsetX, y: chunkY + offsetY };
      if (chunk.x < 0 || chunk.y < 0 || chunk.x > maximumChunkX || chunk.y > maximumChunkY) {
        continue;
      }
      dirty.set(chunkKey(chunk), chunk);
    }
  }
}

function sortedChunks(chunks: Iterable<ChunkCoordinate>): ChunkCoordinate[] {
  return [...chunks].sort(compareChunks);
}

function compareSupportRoots(left: TerrainSupportRoot, right: TerrainSupportRoot): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function isTerrainMaterialCode(value: number): value is TerrainMaterialCode {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4;
}
