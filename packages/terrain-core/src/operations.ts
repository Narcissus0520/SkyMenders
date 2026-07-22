import { hashCanonical } from "@skymenders/deterministic-runtime";

import { resolveTerrainCollapse } from "./collapse.js";
import { applyTerrainDamage, applyTerrainRepair, assertTerrainState } from "./grid.js";
import { analyzeTerrainSupport } from "./support.js";
import { TERRAIN_MAX_OPERATIONS } from "./types.js";
import type {
  TerrainCollapseEvent,
  TerrainMaterialEffect,
  TerrainOperation,
  TerrainOperationCheckpoint,
  TerrainOperationExecution,
  TerrainState,
  TerrainSupportAnalysis,
} from "./types.js";

export function executeTerrainOperations(
  initialState: TerrainState,
  operations: readonly TerrainOperation[],
): TerrainOperationExecution {
  assertTerrainState(initialState);
  if (!Number.isSafeInteger(operations.length) || operations.length > TERRAIN_MAX_OPERATIONS) {
    throw new RangeError(`terrain operation log cannot exceed ${TERRAIN_MAX_OPERATIONS} entries`);
  }
  let state = initialState;
  const checkpoints: TerrainOperationCheckpoint[] = [];
  const materialEffects: TerrainMaterialEffect[] = [];
  const collapseEvents: TerrainCollapseEvent[] = [];
  const supportAnalyses: TerrainSupportAnalysis[] = [];

  operations.forEach((operation, operationIndex) => {
    switch (operation.kind) {
      case "damage": {
        const result = applyTerrainDamage(state, operation.command);
        state = result.state;
        materialEffects.push(...result.effects);
        break;
      }
      case "repair": {
        state = applyTerrainRepair(state, operation.command).state;
        break;
      }
      case "resolve_collapse": {
        const analysis = analyzeTerrainSupport(state);
        const result = resolveTerrainCollapse(state, analysis);
        supportAnalyses.push(analysis);
        collapseEvents.push(...result.events);
        state = result.state;
        break;
      }
      default:
        throw new Error(
          `unsupported terrain operation kind: ${String(
            (operation as { readonly kind?: unknown }).kind,
          )}`,
        );
    }
    checkpoints.push({ operationIndex, stateHash: hashCanonical(state) });
  });

  return { finalState: state, checkpoints, materialEffects, collapseEvents, supportAnalyses };
}
