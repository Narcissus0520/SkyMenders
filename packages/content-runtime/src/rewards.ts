import { deriveRngState, hashCanonical, nextInteger } from "@skymenders/deterministic-runtime";
import type { RngState } from "@skymenders/deterministic-runtime";

import type { PveContentPack } from "@skymenders/content-schema";

import type { LockedRewardSet, RewardContext, RewardDefinition } from "./types.js";

export function generateLockedRewards(
  pack: PveContentPack,
  context: RewardContext,
): LockedRewardSet {
  if (!Number.isSafeInteger(context.rewardIndex) || context.rewardIndex < 0)
    throw new RangeError("reward index must be non-negative");
  let rng = deriveRngState((context.seed ^ context.rewardIndex) >>> 0, "reward");
  const unlocked = new Set(context.unlockedModuleIds);
  const owned = new Set(context.ownedModuleIds);
  let pool = pack.routes.rewardPool.filter(
    (reward) =>
      (reward.moduleId === null || unlocked.has(reward.moduleId)) &&
      (reward.kind !== "module" || reward.moduleId === null || !owned.has(reward.moduleId)) &&
      (reward.kind !== "upgrade" || (reward.moduleId !== null && owned.has(reward.moduleId))),
  );
  if (context.previousCategory === "attack")
    pool = pool.filter((reward) => !reward.tags.includes("attack") || reward.tags.length > 1);
  if (pool.length < 3) throw new Error("reward pool cannot produce three legal choices");

  const weighted = pool.map((reward) => ({
    reward,
    weight:
      reward.kind === "upgrade" && reward.moduleId !== null && owned.has(reward.moduleId)
        ? 4
        : reward.kind === "module" && reward.moduleId !== null && !owned.has(reward.moduleId)
          ? 3
          : 2,
  }));
  const selected: RewardDefinition[] = [];
  const selectedKinds = new Set<string>();
  while (selected.length < 3) {
    const candidates = weighted.filter(
      ({ reward }) => !selected.some((entry) => entry.id === reward.id),
    );
    const diverse = candidates.filter(({ reward }) => !selectedKinds.has(reward.kind));
    const source = diverse.length >= 3 - selected.length ? diverse : candidates;
    const pick = weightedPick(source, rng);
    rng = pick.rng;
    selected.push(pick.reward);
    selectedKinds.add(pick.reward.kind);
  }
  const compatible = selected.some(
    (reward) => reward.moduleId === null || unlocked.has(reward.moduleId),
  );
  if (!compatible) throw new Error("reward set has no squad-compatible choice");
  const choices = selected as [RewardDefinition, RewardDefinition, RewardDefinition];
  return {
    lockId: hashCanonical({
      seed: context.seed,
      rewardIndex: context.rewardIndex,
      choiceIds: choices.map((choice) => choice.id),
    }),
    choices,
    rngState: rng,
  };
}

function weightedPick(
  entries: readonly { readonly reward: RewardDefinition; readonly weight: number }[],
  rng: RngState,
): { readonly reward: RewardDefinition; readonly rng: RngState } {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const result = nextInteger(rng, 1, total);
  let cursor = result.value;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return { reward: entry.reward, rng: result.state };
  }
  throw new Error("weighted reward selection exhausted unexpectedly");
}
