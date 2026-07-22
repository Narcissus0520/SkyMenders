export const TERRAIN_MATERIAL_IDS = [
  "terrain_cloud_soil",
  "terrain_alloy_frame",
  "terrain_energy_crystal",
  "terrain_elastic_moss",
] as const;

export type TerrainMaterialId = (typeof TERRAIN_MATERIAL_IDS)[number];
export type TerrainMaterialCode = 0 | 1 | 2 | 3 | 4;

export interface TerrainMaterialDefinition {
  readonly id: TerrainMaterialId;
  readonly code: Exclude<TerrainMaterialCode, 0>;
  readonly hardnessPermille: number;
  readonly supportPermille: number;
  readonly repairCostPermille: number;
  readonly projectileRestitutionPermille: number;
  readonly fallDamagePermille: number;
  readonly magnetic: boolean;
  readonly energyReleasePermille: number;
  readonly accessibilityPattern: "speckled" | "crosshatch" | "faceted" | "wavy";
}

export const TERRAIN_MATERIALS = {
  terrain_cloud_soil: {
    id: "terrain_cloud_soil",
    code: 1,
    hardnessPermille: 300,
    supportPermille: 600,
    repairCostPermille: 350,
    projectileRestitutionPermille: 350,
    fallDamagePermille: 850,
    magnetic: false,
    energyReleasePermille: 0,
    accessibilityPattern: "speckled",
  },
  terrain_alloy_frame: {
    id: "terrain_alloy_frame",
    code: 2,
    hardnessPermille: 900,
    supportPermille: 950,
    repairCostPermille: 900,
    projectileRestitutionPermille: 700,
    fallDamagePermille: 1_000,
    magnetic: true,
    energyReleasePermille: 0,
    accessibilityPattern: "crosshatch",
  },
  terrain_energy_crystal: {
    id: "terrain_energy_crystal",
    code: 3,
    hardnessPermille: 500,
    supportPermille: 250,
    repairCostPermille: 700,
    projectileRestitutionPermille: 800,
    fallDamagePermille: 1_100,
    magnetic: false,
    energyReleasePermille: 400,
    accessibilityPattern: "faceted",
  },
  terrain_elastic_moss: {
    id: "terrain_elastic_moss",
    code: 4,
    hardnessPermille: 200,
    supportPermille: 150,
    repairCostPermille: 200,
    projectileRestitutionPermille: 1_300,
    fallDamagePermille: 300,
    magnetic: false,
    energyReleasePermille: 0,
    accessibilityPattern: "wavy",
  },
} as const satisfies Readonly<Record<TerrainMaterialId, TerrainMaterialDefinition>>;

export function materialIdToCode(id: TerrainMaterialId): Exclude<TerrainMaterialCode, 0> {
  return TERRAIN_MATERIALS[id].code;
}

export function materialCodeToId(code: TerrainMaterialCode): TerrainMaterialId {
  switch (code) {
    case 1:
      return "terrain_cloud_soil";
    case 2:
      return "terrain_alloy_frame";
    case 3:
      return "terrain_energy_crystal";
    case 4:
      return "terrain_elastic_moss";
    case 0:
      throw new RangeError("empty terrain has no material id");
  }
}

export function getTerrainMaterial(
  idOrCode: TerrainMaterialId | Exclude<TerrainMaterialCode, 0>,
): TerrainMaterialDefinition {
  return typeof idOrCode === "string"
    ? TERRAIN_MATERIALS[idOrCode]
    : TERRAIN_MATERIALS[materialCodeToId(idOrCode)];
}
