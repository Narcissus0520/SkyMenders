import { describe, expect, it } from "vitest";

import {
  TERRAIN_MATERIALS,
  TERRAIN_MATERIAL_IDS,
  getTerrainMaterial,
  materialCodeToId,
  materialIdToCode,
} from "../src/index.js";

describe("terrain material registry", () => {
  it("defines four distinct mechanics and accessibility patterns", () => {
    expect(TERRAIN_MATERIAL_IDS).toHaveLength(4);
    expect(new Set(TERRAIN_MATERIAL_IDS.map((id) => TERRAIN_MATERIALS[id].code))).toHaveLength(4);
    expect(
      new Set(TERRAIN_MATERIAL_IDS.map((id) => TERRAIN_MATERIALS[id].accessibilityPattern)).size,
    ).toBe(4);
    expect(TERRAIN_MATERIALS.terrain_alloy_frame.magnetic).toBe(true);
    expect(TERRAIN_MATERIALS.terrain_energy_crystal.energyReleasePermille).toBeGreaterThan(0);
    expect(TERRAIN_MATERIALS.terrain_elastic_moss.projectileRestitutionPermille).toBeGreaterThan(
      1_000,
    );
    expect(TERRAIN_MATERIALS.terrain_elastic_moss.fallDamagePermille).toBeLessThan(
      TERRAIN_MATERIALS.terrain_alloy_frame.fallDamagePermille,
    );
  });

  it("round-trips stable material codes", () => {
    for (const id of TERRAIN_MATERIAL_IDS) {
      const code = materialIdToCode(id);
      expect(materialCodeToId(code)).toBe(id);
      expect(getTerrainMaterial(code)).toBe(TERRAIN_MATERIALS[id]);
      expect(getTerrainMaterial(id)).toBe(TERRAIN_MATERIALS[id]);
    }
    expect(() => materialCodeToId(0)).toThrow("empty terrain");
  });
});
