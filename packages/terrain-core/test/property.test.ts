import { deriveRngState, hashCanonical, nextInteger } from "@skymenders/deterministic-runtime";
import type { RngState } from "@skymenders/deterministic-runtime";
import { describe, expect, it } from "vitest";

import {
  TERRAIN_MATERIAL_IDS,
  analyzeTerrainSupport,
  applyTerrainDamage,
  assertTerrainState,
  clearTerrainDirtyChunks,
  createTerrainState,
  resolveTerrainCollapse,
} from "../src/index.js";
import type { TerrainFill } from "../src/index.js";

describe("generated terrain properties", () => {
  it("preserves grid invariants and determinism across generated damage cases", () => {
    for (let seed = 0; seed < 64; seed += 1) {
      let rng = deriveRngState(seed, "map");
      const fills: TerrainFill[] = [];
      for (let x = 0; x < 16; x += 1) {
        const materialDraw = draw(rng, 0, TERRAIN_MATERIAL_IDS.length - 1);
        rng = materialDraw.state;
        fills.push({
          x,
          y: 0,
          width: 1,
          height: 1,
          materialId: materialAt(materialDraw.value),
        });
      }
      const floatingMaterial = draw(rng, 0, TERRAIN_MATERIAL_IDS.length - 1);
      rng = floatingMaterial.state;
      fills.push({
        x: 5,
        y: 5,
        width: 5,
        height: 2,
        materialId: materialAt(floatingMaterial.value),
      });
      const damageX = draw(rng, 0, 15);
      rng = damageX.state;
      const energy = draw(rng, 1, 2_000);

      const state = clearTerrainDirtyChunks(
        createTerrainState({
          width: 16,
          height: 10,
          fills,
          supportRoots: [{ id: "anchor", kind: "fixed_anchor", x: 0, y: 0, capacity: 20_000 }],
        }),
      );
      const command = { x: damageX.value, y: 0, radius: seed % 3, energy: energy.value };
      const firstDamage = applyTerrainDamage(state, command);
      const secondDamage = applyTerrainDamage(state, command);
      assertTerrainState(firstDamage.state);
      expect(firstDamage).toEqual(secondDamage);
      expect(firstDamage.state.materials.filter((code) => code !== 0).length).toBeLessThanOrEqual(
        state.materials.filter((code) => code !== 0).length,
      );
      firstDamage.state.integrities.forEach((integrity, index) => {
        expect(integrity).toBeLessThanOrEqual(state.integrities[index] ?? 0);
      });

      const firstAnalysis = analyzeTerrainSupport(firstDamage.state);
      const secondAnalysis = analyzeTerrainSupport(firstDamage.state);
      expect(firstAnalysis).toEqual(secondAnalysis);
      const firstCollapse = resolveTerrainCollapse(firstDamage.state, firstAnalysis);
      const secondCollapse = resolveTerrainCollapse(firstDamage.state, secondAnalysis);
      assertTerrainState(firstCollapse.state);
      expect(firstCollapse).toEqual(secondCollapse);
      expect(hashCanonical(firstCollapse.state)).toBe(hashCanonical(secondCollapse.state));
    }
  });
});

function draw(
  state: RngState,
  minimum: number,
  maximum: number,
): { readonly value: number; readonly state: RngState } {
  return nextInteger(state, minimum, maximum);
}

function materialAt(index: number): (typeof TERRAIN_MATERIAL_IDS)[number] {
  const material = TERRAIN_MATERIAL_IDS[index];
  if (material === undefined) throw new RangeError(`invalid generated material index: ${index}`);
  return material;
}
