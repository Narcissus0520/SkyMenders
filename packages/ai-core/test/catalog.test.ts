import { describe, expect, it } from "vitest";

import { validateModuleLoadout } from "@skymenders/battle-core";

import {
  AI_DIFFICULTIES,
  AI_DIFFICULTY_PROFILES,
  BOSS_DEFINITIONS,
  BOSS_IDS,
  ELITE_AFFIX_DEFINITIONS,
  ELITE_AFFIX_IDS,
  ELITE_TEMPLATE_DEFINITIONS,
  ELITE_TEMPLATE_IDS,
  ENEMY_DEFINITIONS,
  ENEMY_PROTOTYPE_IDS,
  createBossActor,
  createEnemyActor,
  mergedUtilityWeights,
  validateAiCatalog,
} from "../src/index.js";

describe("enemy, elite, boss, and difficulty catalogs", () => {
  it("contains every mandatory launch definition and validates as a whole", () => {
    expect(Object.keys(ENEMY_DEFINITIONS).sort()).toEqual([...ENEMY_PROTOTYPE_IDS].sort());
    expect(Object.keys(ELITE_AFFIX_DEFINITIONS).sort()).toEqual([...ELITE_AFFIX_IDS].sort());
    expect(Object.keys(ELITE_TEMPLATE_DEFINITIONS).sort()).toEqual([...ELITE_TEMPLATE_IDS].sort());
    expect(Object.keys(BOSS_DEFINITIONS).sort()).toEqual([...BOSS_IDS].sort());
    expect(validateAiCatalog()).toEqual({ valid: true, issues: [] });
  });

  it("gives every enemy and boss a valid executable battle loadout", () => {
    for (const [index, prototypeId] of ENEMY_PROTOTYPE_IDS.entries()) {
      const actor = createEnemyActor(`enemy:${index}`, prototypeId, index + 1, 1);
      expect(actor.team).toBe("enemy");
      expect(actor.hp).toBe(ENEMY_DEFINITIONS[prototypeId].baseHp);
      expect(validateModuleLoadout(actor)).toEqual([]);
    }
    for (const [index, bossId] of BOSS_IDS.entries()) {
      const actor = createBossActor(`boss:${index}`, bossId, index + 1, 1);
      expect(actor.hp).toBe(BOSS_DEFINITIONS[bossId].baseHp);
      expect(validateModuleLoadout(actor)).toEqual([]);
      expect(BOSS_DEFINITIONS[bossId].stages).toHaveLength(3);
      expect(BOSS_DEFINITIONS[bossId].solutionRoutes).toHaveLength(2);
    }
  });

  it("changes search and deterministic error rather than health or damage multipliers", () => {
    expect(Object.keys(AI_DIFFICULTY_PROFILES)).toEqual(AI_DIFFICULTIES);
    const normal = AI_DIFFICULTY_PROFILES.normal;
    const hard = AI_DIFFICULTY_PROFILES.hard;
    const expert = AI_DIFFICULTY_PROFILES.expert;
    expect(normal.maximumCandidates).toBeLessThan(hard.maximumCandidates);
    expect(hard.maximumCandidates).toBeLessThan(expert.maximumCandidates);
    expect(normal.angleErrorMilliDegrees).toBeGreaterThan(hard.angleErrorMilliDegrees);
    expect(hard.angleErrorMilliDegrees).toBeGreaterThan(expert.angleErrorMilliDegrees);
    expect("healthMultiplier" in normal).toBe(false);
    expect("damageMultiplier" in expert).toBe(false);
  });

  it("applies elite affixes as strategic weight changes through the whitelist", () => {
    expect(Object.values(ELITE_TEMPLATE_DEFINITIONS)).toHaveLength(8);
    const base = ENEMY_DEFINITIONS.enemy_wind.utilityWeights;
    const merged = mergedUtilityWeights(base, ["overdrive_circuit", "coordinated_protocol"]);
    expect(merged.expectedDamage).toBeGreaterThan(base.expectedDamage);
    expect(merged.controlBenefit).toBeGreaterThan(base.controlBenefit);
    expect(merged.energyCost).toBeLessThan(base.energyCost);
  });
});
