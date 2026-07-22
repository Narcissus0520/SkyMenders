import { getTerrainMaterial } from "./materials.js";
import {
  assertTerrainState,
  terrainDirtyChunksForCells,
  terrainIndex,
  terrainPoint,
} from "./grid.js";
import type {
  GridPoint,
  TerrainCollapseEvent,
  TerrainCollapseResult,
  TerrainState,
  TerrainSupportAnalysis,
} from "./types.js";

interface FallingCell {
  readonly sourceIndex: number;
  readonly x: number;
  readonly y: number;
  readonly material: 1 | 2 | 3 | 4;
  readonly integrity: number;
}

export function resolveTerrainCollapse(
  state: TerrainState,
  analysis: TerrainSupportAnalysis,
): TerrainCollapseResult {
  assertTerrainState(state);
  const components = validateAndOrderComponents(state, analysis.unstableComponents);
  if (components.length === 0) return { state, events: [] };

  const materials = [...state.materials];
  const integrities = [...state.integrities];
  const fallingBlocks = components.map((component) =>
    component.map((index): FallingCell => {
      const point = terrainPoint(state.width, index);
      const material = materials[index];
      const integrity = integrities[index];
      if (material === undefined || material === 0 || integrity === undefined || integrity === 0) {
        throw new Error(`collapse source must be occupied at index ${index}`);
      }
      materials[index] = 0;
      integrities[index] = 0;
      return { sourceIndex: index, ...point, material, integrity };
    }),
  );

  const events: TerrainCollapseEvent[] = [];
  const dirtyPoints: GridPoint[] = fallingBlocks.flatMap((block) =>
    block.map((cell) => ({ x: cell.x, y: cell.y })),
  );

  fallingBlocks.forEach((block, ordinal) => {
    let fallDistance = 1;
    let outcome: TerrainCollapseEvent["outcome"] = "lost";
    let settledDistance = 0;

    for (; fallDistance <= state.height + 1; fallDistance += 1) {
      const exitsGrid = block.some((cell) => cell.y - fallDistance < 0);
      if (exitsGrid) {
        outcome = "lost";
        settledDistance = fallDistance;
        break;
      }
      const collides = block.some((cell) => {
        const destination = terrainIndex(state.width, cell.x, cell.y - fallDistance);
        return materials[destination] !== 0;
      });
      if (collides) {
        outcome = "settled";
        settledDistance = fallDistance - 1;
        break;
      }
    }

    const destinationCellIndices: number[] = [];
    if (outcome === "settled") {
      for (const cell of block) {
        const destinationY = cell.y - settledDistance;
        const destination = terrainIndex(state.width, cell.x, destinationY);
        if (materials[destination] !== 0) {
          throw new Error(`deterministic collapse overlap at index ${destination}`);
        }
        materials[destination] = cell.material;
        integrities[destination] = cell.integrity;
        destinationCellIndices.push(destination);
        dirtyPoints.push({ x: cell.x, y: destinationY });
      }
    }

    const averageFallDamage = Math.trunc(
      block.reduce(
        (total, cell) => total + getTerrainMaterial(cell.material).fallDamagePermille,
        0,
      ) / block.length,
    );
    events.push({
      kind: "terrain_block_collapsed",
      blockId: `collapse:${state.revision + 1}:${ordinal}`,
      sourceCellIndices: block.map((cell) => cell.sourceIndex),
      destinationCellIndices,
      fallDistance: settledDistance,
      impactEnergy:
        outcome === "settled"
          ? Math.min(1_000, Math.trunc((settledDistance * 100 * averageFallDamage) / 1_000))
          : 0,
      outcome,
    });
  });

  return {
    state: {
      ...state,
      materials,
      integrities,
      dirtyChunks: terrainDirtyChunksForCells(state, dirtyPoints),
      revision: state.revision + 1,
    },
    events,
  };
}

function validateAndOrderComponents(
  state: TerrainState,
  input: readonly (readonly number[])[],
): number[][] {
  const seen = new Set<number>();
  const components = input.map((inputComponent) => {
    if (inputComponent.length === 0) throw new RangeError("collapse component cannot be empty");
    const component = [...inputComponent].sort((left, right) => left - right);
    for (const index of component) {
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= state.materials.length ||
        seen.has(index)
      ) {
        throw new RangeError(`invalid or duplicate collapse cell index: ${index}`);
      }
      seen.add(index);
    }
    return component;
  });
  components.sort((left, right) => {
    const leftMinimumY = Math.min(...left.map((index) => terrainPoint(state.width, index).y));
    const rightMinimumY = Math.min(...right.map((index) => terrainPoint(state.width, index).y));
    return leftMinimumY - rightMinimumY || (left[0] ?? 0) - (right[0] ?? 0);
  });
  return components;
}
