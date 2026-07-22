import type { TerrainMaterialCode, TerrainMaterialId } from "./materials.js";

export const TERRAIN_SCHEMA_VERSION = "0.1.0";
export const TERRAIN_CHUNK_SIZE = 32;
export const TERRAIN_MAX_CELLS = 32_768;
export const TERRAIN_MAX_INTEGRITY = 1_000;
export const TERRAIN_MAX_OPERATIONS = 10_000;

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface ChunkCoordinate {
  readonly x: number;
  readonly y: number;
}

export type TerrainSupportKind = "fixed_anchor" | "support_structure";

export interface TerrainSupportRoot extends GridPoint {
  readonly id: string;
  readonly kind: string;
  readonly capacity: number;
}

export interface TerrainFill {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly materialId: TerrainMaterialId;
  readonly integrity?: number;
}

export interface TerrainState {
  readonly terrainSchemaVersion: string;
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly materials: readonly TerrainMaterialCode[];
  readonly integrities: readonly number[];
  readonly supportRoots: readonly TerrainSupportRoot[];
  readonly dirtyChunks: readonly ChunkCoordinate[];
  readonly revision: number;
}

export interface TerrainCell {
  readonly materialId: TerrainMaterialId;
  readonly integrity: number;
}

export interface TerrainDamageCommand extends GridPoint {
  readonly radius: number;
  readonly energy: number;
}

export interface DamagedTerrainCell extends GridPoint {
  readonly materialId: TerrainMaterialId;
  readonly integrityBefore: number;
  readonly integrityAfter: number;
  readonly destroyed: boolean;
}

export interface TerrainMaterialEffect extends GridPoint {
  readonly kind: "energy_release";
  readonly amount: number;
}

export interface TerrainDamageResult {
  readonly state: TerrainState;
  readonly affectedCells: readonly DamagedTerrainCell[];
  readonly effects: readonly TerrainMaterialEffect[];
}

export interface TerrainRepairCommand extends GridPoint {
  readonly materialId: TerrainMaterialId;
  readonly amount: number;
  readonly availableEnergy: number;
}

export interface TerrainRepairResult {
  readonly state: TerrainState;
  readonly repairedIntegrity: number;
  readonly energySpent: number;
}

export type SupportAnalysisScope = "full" | "dirty_components";

export interface TerrainSupportAnalysis {
  readonly scope: SupportAnalysisScope;
  readonly supportedCellIndices: readonly number[];
  readonly unstableComponents: readonly (readonly number[])[];
  readonly inspectedCellCount: number;
  readonly inspectedChunks: readonly ChunkCoordinate[];
}

export type CollapseOutcome = "settled" | "lost";

export interface TerrainCollapseEvent {
  readonly kind: "terrain_block_collapsed";
  readonly blockId: string;
  readonly sourceCellIndices: readonly number[];
  readonly destinationCellIndices: readonly number[];
  readonly fallDistance: number;
  readonly impactEnergy: number;
  readonly outcome: CollapseOutcome;
}

export interface TerrainCollapseResult {
  readonly state: TerrainState;
  readonly events: readonly TerrainCollapseEvent[];
}

export type TerrainOperation =
  | { readonly kind: "damage"; readonly command: TerrainDamageCommand }
  | { readonly kind: "repair"; readonly command: TerrainRepairCommand }
  | { readonly kind: "resolve_collapse" };

export interface TerrainOperationCheckpoint {
  readonly operationIndex: number;
  readonly stateHash: string;
}

export interface TerrainOperationExecution {
  readonly finalState: TerrainState;
  readonly checkpoints: readonly TerrainOperationCheckpoint[];
  readonly materialEffects: readonly TerrainMaterialEffect[];
  readonly collapseEvents: readonly TerrainCollapseEvent[];
  readonly supportAnalyses: readonly TerrainSupportAnalysis[];
}

export interface TerrainObjective {
  readonly id: string;
  readonly position: GridPoint;
  readonly supportCell: GridPoint;
  readonly accessPoint: GridPoint;
}

export interface CameraBounds {
  readonly minimumX: number;
  readonly minimumY: number;
  readonly maximumX: number;
  readonly maximumY: number;
}

export interface TerrainMapDefinition {
  readonly mapId: string;
  readonly terrain: TerrainState;
  readonly playerSpawns: readonly GridPoint[];
  readonly enemySpawns: readonly GridPoint[];
  readonly objectives: readonly TerrainObjective[];
  readonly keyEngagementPoints: readonly GridPoint[];
  readonly navigationCells: readonly GridPoint[];
  readonly requiredCapabilities: readonly string[];
  readonly availableCapabilities: readonly string[];
  readonly cameraBounds: CameraBounds;
}

export type MapValidationSeverity = "error" | "warning";

export interface MapValidationIssue {
  readonly code: string;
  readonly severity: MapValidationSeverity;
  readonly path: string;
  readonly message: string;
}

export interface TerrainMapValidationReport {
  readonly mapId: string;
  readonly valid: boolean;
  readonly issues: readonly MapValidationIssue[];
  readonly metrics: {
    readonly occupiedCells: number;
    readonly supportedCells: number;
    readonly unstableCells: number;
    readonly navigationCells: number;
  };
}
