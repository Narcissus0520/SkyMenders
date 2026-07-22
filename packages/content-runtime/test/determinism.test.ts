import { hashCanonical } from "@skymenders/deterministic-runtime";
import { describe, expect, it } from "vitest";

import { generateExpeditionPlan, generateLockedRewards } from "../src/index.js";

import { loadPack } from "./fixture.js";

const pack = loadPack();

describe("PvE content determinism", () => {
  it("reproduces routes and rewards across a seed corpus", () => {
    const hashes = [0, 1, 42, 0x7fff_ffff, 0xffff_ffff].map((seed) => {
      const plan = generateExpeditionPlan(pack, seed);
      const reward = generateLockedRewards(pack, {
        seed,
        rewardIndex: 7,
        squadRobotIds: ["robot_rivet", "robot_anchor", "robot_gale"],
        unlockedModuleIds: pack.modules.modules.map((module) => module.id),
        ownedModuleIds: ["main_fold_bridge", "aux_repair_spray"],
        previousCategory: null,
      });
      return hashCanonical({ plan, reward });
    });
    const replayed = [0, 1, 42, 0x7fff_ffff, 0xffff_ffff].map((seed) =>
      hashCanonical({
        plan: generateExpeditionPlan(pack, seed),
        reward: generateLockedRewards(pack, {
          seed,
          rewardIndex: 7,
          squadRobotIds: ["robot_rivet", "robot_anchor", "robot_gale"],
          unlockedModuleIds: pack.modules.modules.map((module) => module.id),
          ownedModuleIds: ["main_fold_bridge", "aux_repair_spray"],
          previousCategory: null,
        }),
      }),
    );
    expect(replayed).toEqual(hashes);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
