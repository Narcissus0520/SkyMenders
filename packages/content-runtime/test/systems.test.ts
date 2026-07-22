import { describe, expect, it } from "vitest";

import {
  applyEventChoice,
  applyTutorialAction,
  buyWorkshopService,
  canEnterRankedDailyChallenge,
  canEnterStandardExpedition,
  claimReward,
  createExpeditionState,
  createProgressionState,
  discoverCompendiumEntry,
  deriveRunModifiers,
  generateExpeditionPlan,
  generateLockedRewards,
  grantResearch,
  purchaseUnlock,
  recordProgressMetric,
  startTutorial,
} from "../src/index.js";
import type { ExpeditionState } from "../src/index.js";

import { loadPack } from "./fixture.js";

const pack = loadPack();
const squad = ["robot_rivet", "robot_anchor", "robot_gale"] as const;

describe("rewards, progression, workshop, events, and tutorials", () => {
  it("locks three deterministic, distinct and compatible reward choices", () => {
    const context = {
      seed: 88,
      rewardIndex: 2,
      squadRobotIds: squad,
      unlockedModuleIds: [...pack.progression.initialModuleIds],
      ownedModuleIds: ["main_fold_bridge"],
      previousCategory: null,
    };
    const first = generateLockedRewards(pack, context);
    const second = generateLockedRewards(pack, context);
    expect(first).toEqual(second);
    expect(first.choices).toHaveLength(3);
    expect(new Set(first.choices.map((choice) => choice.id)).size).toBe(3);
    expect(
      first.choices.some(
        (choice) => choice.moduleId === null || context.unlockedModuleIds.includes(choice.moduleId),
      ),
    ).toBe(true);
    expect(
      first.choices.every(
        (choice) =>
          choice.kind !== "upgrade" ||
          (choice.moduleId !== null && context.ownedModuleIds.includes(choice.moduleId)),
      ),
    ).toBe(true);
    expect(
      first.choices.every(
        (choice) =>
          choice.kind !== "module" ||
          (choice.moduleId !== null && !context.ownedModuleIds.includes(choice.moduleId)),
      ),
    ).toBe(true);
    expect(
      generateLockedRewards(pack, { ...context, previousCategory: "attack" }).choices.every(
        (choice) => !choice.tags.includes("attack") || choice.tags.length > 1,
      ),
    ).toBe(true);
    expect(() => generateLockedRewards(pack, { ...context, rewardIndex: -1 })).toThrow(
      "non-negative",
    );
    expect(() =>
      generateLockedRewards(
        { ...pack, routes: { ...pack.routes, rewardPool: pack.routes.rewardPool.slice(0, 2) } },
        context,
      ),
    ).toThrow("three legal");
  });

  it("unlocks content without permanent combat stat fields and records achievements", () => {
    let state = createProgressionState(pack);
    expect(state.unlockedIds).toContain("robot_rivet");
    expect(Object.keys(state)).not.toEqual(
      expect.arrayContaining(["baseHp", "damage", "energyMaximum"]),
    );
    expect(() => grantResearch(state, -1)).toThrow("non-negative");
    expect(() => purchaseUnlock(pack, state, "missing")).toThrow("not found");
    expect(() => purchaseUnlock(pack, state, "unlock_robot_forge")).toThrow("prerequisites");
    state = grantResearch(state, 100);
    state = purchaseUnlock(pack, state, "unlock_robot_prism");
    expect(purchaseUnlock(pack, state, "unlock_robot_prism")).toBe(state);
    state = purchaseUnlock(pack, state, "unlock_robot_forge");
    expect(state.unlockedIds).toContain("robot_forge");
    expect(() => purchaseUnlock(pack, { ...state, research: 0 }, "unlock_robot_echo")).toThrow(
      "insufficient",
    );
    expect(() => recordProgressMetric(pack, state, "repairs", 0)).toThrow("positive");
    state = recordProgressMetric(pack, state, "repairs", 100);
    expect(state.completedAchievementIds).toEqual(
      expect.arrayContaining(["achievement_first_repair", "achievement_master_repair"]),
    );
    expect(() => discoverCompendiumEntry(pack, state, "missing")).toThrow("not found");
    state = discoverCompendiumEntry(pack, state, "compendium_robot_rivet");
    expect(discoverCompendiumEntry(pack, state, "compendium_robot_rivet")).toBe(state);
  });

  it("applies bounded workshop and event outcomes", () => {
    let expedition: ExpeditionState = {
      ...createExpeditionState(generateExpeditionPlan(pack, 3), squad),
      supplies: 20,
      researchEarned: 5,
      robots: [
        {
          robotId: "robot_rivet" as const,
          hp: 50,
          maxHp: 100,
          structuralDamage: 60,
          disabled: false,
        },
        {
          robotId: "robot_anchor" as const,
          hp: 90,
          maxHp: 100,
          structuralDamage: 10,
          disabled: false,
        },
        {
          robotId: "robot_gale" as const,
          hp: 100,
          maxHp: 100,
          structuralDamage: 0,
          disabled: false,
        },
      ],
    };
    expedition = buyWorkshopService(pack, expedition, "workshop_field_repair", "robot_rivet");
    expect(expedition.robots[0]?.hp).toBe(75);
    expedition = buyWorkshopService(
      pack,
      expedition,
      "workshop_structural_alignment",
      "robot_rivet",
    );
    expect(expedition.robots[0]?.structuralDamage).toBe(30);
    expect(() =>
      buyWorkshopService(pack, expedition, "workshop_install_module", "robot_rivet"),
    ).toThrow("target");
    expedition = buyWorkshopService(
      pack,
      expedition,
      "workshop_install_module",
      "robot_rivet",
      "aux_reflector",
    );
    expect(expedition.inventory.moduleIds).toContain("aux_reflector");
    expect(() =>
      buyWorkshopService(
        pack,
        { ...expedition, supplies: 100 },
        "workshop_install_module",
        "robot_rivet",
        "aux_reflector",
      ),
    ).toThrow("already installed");
    expect(() =>
      buyWorkshopService(
        pack,
        expedition,
        "workshop_route_calibration",
        "robot_rivet",
        "jammer_silence",
      ),
    ).toThrow("requires");
    expedition = buyWorkshopService(
      pack,
      expedition,
      "workshop_route_calibration",
      "robot_rivet",
      "reflector_prismatic",
    );
    expect(expedition.inventory.upgradeRouteIds).toContain("reflector_prismatic");
    expect(() =>
      buyWorkshopService(
        pack,
        { ...expedition, supplies: 100 },
        "workshop_route_calibration",
        "robot_rivet",
        "reflector_wide_guard",
      ),
    ).toThrow("mutually exclusive");
    expect(() =>
      buyWorkshopService(
        pack,
        { ...expedition, supplies: 0 },
        "workshop_route_calibration",
        "robot_rivet",
      ),
    ).toThrow("insufficient");
    expect(() => buyWorkshopService(pack, expedition, "missing", "robot_rivet")).toThrow(
      "not found",
    );
    expect(() =>
      buyWorkshopService(pack, { ...expedition, supplies: 10 }, "workshop_field_repair", "missing"),
    ).toThrow("not found in squad");
    expect(() =>
      buyWorkshopService(
        pack,
        { ...expedition, status: "victory" },
        "workshop_field_repair",
        "robot_rivet",
      ),
    ).toThrow("unavailable");
    expect(
      applyEventChoice(pack, expedition, "event_drifting_toolbox", "catalog_parts").researchEarned,
    ).toBe(8);
    expect(
      applyEventChoice(pack, expedition, "event_frayed_bridge", "repair_crossing").robots[0]
        ?.structuralDamage,
    ).toBe(22);
    expect(
      applyEventChoice(pack, expedition, "event_rescue_beacon", "answer_beacon").robots[0]?.hp,
    ).toBe(90);
    expect(
      applyEventChoice(pack, expedition, "event_drifting_toolbox", "secure_tools").inventory
        .consumables,
    ).toBe(2);
    expect(
      applyEventChoice(pack, expedition, "event_sleeping_relay", "restart_relay").routeRevealDepth,
    ).toBe(2);
    expect(() => applyEventChoice(pack, expedition, "missing", "missing")).toThrow("not found");
    const moduleReward = pack.routes.rewardPool.find(
      (reward) => reward.id === "reward_module_drill",
    );
    const upgradeReward = pack.routes.rewardPool.find(
      (reward) => reward.id === "reward_upgrade_drill",
    );
    const consumableReward = pack.routes.rewardPool.find((reward) => reward.kind === "consumable");
    const intelReward = pack.routes.rewardPool.find((reward) => reward.kind === "intel");
    if (
      moduleReward === undefined ||
      upgradeReward === undefined ||
      consumableReward === undefined ||
      intelReward === undefined
    )
      throw new Error("reward fixture missing");
    const temporaryModReward = pack.routes.rewardPool.find(
      (reward) => reward.kind === "temporary_mod",
    );
    if (temporaryModReward === undefined) throw new Error("temporary mod reward fixture missing");
    expect(() => claimReward(pack, expedition, upgradeReward)).toThrow("requires");
    expedition = claimReward(pack, expedition, moduleReward);
    expedition = claimReward(pack, expedition, upgradeReward);
    expedition = claimReward(pack, expedition, consumableReward);
    expedition = claimReward(pack, expedition, intelReward);
    expedition = claimReward(pack, expedition, temporaryModReward);
    expect(expedition.inventory.upgradeRouteIds).toContain("drill_bee_precision");
    expect(expedition.inventory.temporaryModIds).toContain(temporaryModReward.id);
    expect(deriveRunModifiers(pack, expedition).movementEfficiencyPermille).toBe(1_150);
    expect(() =>
      deriveRunModifiers(pack, {
        ...expedition,
        inventory: { ...expedition.inventory, temporaryModIds: ["missing"] },
      }),
    ).toThrow("definition not found");
  });

  it("requires all six tutorials and verifies every key action", () => {
    const tutorial = pack.tutorials.tutorials[0];
    if (tutorial === undefined) throw new Error("tutorial missing");
    let state = startTutorial(pack, tutorial.id);
    expect(() => startTutorial(pack, "missing")).toThrow("not found");
    expect(() => applyTutorialAction(pack, state, "confirm_shot")).toThrow("expected");
    for (const step of tutorial.steps) state = applyTutorialAction(pack, state, step.validation);
    expect(state.completed).toBe(true);
    expect(applyTutorialAction(pack, state, "anything")).toBe(state);
    expect(canEnterStandardExpedition(pack, ["tutorial_06_mini_expedition"])).toBe(true);
    expect(canEnterStandardExpedition(pack, [])).toBe(false);
    expect(canEnterRankedDailyChallenge(0)).toBe(false);
    expect(canEnterRankedDailyChallenge(1)).toBe(true);
    expect(canEnterRankedDailyChallenge(1.5)).toBe(false);
  });
});
