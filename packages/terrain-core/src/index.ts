export { resolveTerrainCollapse } from "./collapse.js";
export {
  applyTerrainDamage,
  applyTerrainRepair,
  addTerrainSupportRoot,
  assertTerrainState,
  chunkKey,
  clearTerrainDirtyChunks,
  compareChunks,
  createTerrainState,
  getTerrainCell,
  isTerrainPointInBounds,
  removeTerrainSupportRoot,
  terrainDirtyChunksForCells,
  terrainIndex,
  terrainPoint,
} from "./grid.js";
export type { CreateTerrainStateInput } from "./grid.js";
export {
  TERRAIN_MATERIALS,
  TERRAIN_MATERIAL_IDS,
  getTerrainMaterial,
  materialCodeToId,
  materialIdToCode,
} from "./materials.js";
export type {
  TerrainMaterialCode,
  TerrainMaterialDefinition,
  TerrainMaterialId,
} from "./materials.js";
export { validateTerrainMap } from "./map-validator.js";
export { executeTerrainOperations } from "./operations.js";
export { analyzeTerrainSupport } from "./support.js";
export type { AnalyzeTerrainSupportOptions } from "./support.js";
export {
  TERRAIN_CHUNK_SIZE,
  TERRAIN_MAX_CELLS,
  TERRAIN_MAX_INTEGRITY,
  TERRAIN_SCHEMA_VERSION,
} from "./types.js";
export type {
  CameraBounds,
  ChunkCoordinate,
  CollapseOutcome,
  DamagedTerrainCell,
  GridPoint,
  MapValidationIssue,
  MapValidationSeverity,
  SupportAnalysisScope,
  TerrainCell,
  TerrainCollapseEvent,
  TerrainCollapseResult,
  TerrainDamageCommand,
  TerrainDamageResult,
  TerrainFill,
  TerrainMapDefinition,
  TerrainMapValidationReport,
  TerrainMaterialEffect,
  TerrainObjective,
  TerrainOperation,
  TerrainOperationCheckpoint,
  TerrainOperationExecution,
  TerrainRepairCommand,
  TerrainRepairResult,
  TerrainState,
  TerrainSupportAnalysis,
  TerrainSupportKind,
  TerrainSupportRoot,
} from "./types.js";
