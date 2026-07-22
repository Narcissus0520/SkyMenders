import type { PveContentPack } from "@skymenders/content-schema";

import type { ProgressionState } from "./types.js";

export function createProgressionState(pack: PveContentPack): ProgressionState {
  return {
    research: 0,
    unlockedIds: [
      ...pack.progression.initialRobotIds,
      ...pack.progression.initialModuleIds,
      ...pack.progression.initialRegionIds,
    ].sort(),
    completedAchievementIds: [],
    compendiumEntryIds: [],
    metrics: {},
  };
}

export function grantResearch(state: ProgressionState, amount: number): ProgressionState {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new RangeError("research grant must be a non-negative safe integer");
  return { ...state, research: state.research + amount };
}

export function purchaseUnlock(
  pack: PveContentPack,
  state: ProgressionState,
  unlockId: string,
): ProgressionState {
  const unlock = pack.progression.unlocks.find((candidate) => candidate.id === unlockId);
  if (unlock === undefined) throw new Error(`unlock not found: ${unlockId}`);
  if (state.unlockedIds.includes(unlock.targetId)) return state;
  const unlocked = new Set(state.unlockedIds);
  if (!unlock.prerequisites.every((prerequisite) => unlocked.has(prerequisite)))
    throw new Error(`unlock prerequisites not met: ${unlockId}`);
  if (state.research < unlock.researchCost)
    throw new Error(`insufficient research for unlock: ${unlockId}`);
  return {
    ...state,
    research: state.research - unlock.researchCost,
    unlockedIds: [...state.unlockedIds, unlock.targetId].sort(),
  };
}

export function recordProgressMetric(
  pack: PveContentPack,
  state: ProgressionState,
  metric: string,
  amount = 1,
): ProgressionState {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new RangeError("metric amount must be a positive safe integer");
  const metrics = { ...state.metrics, [metric]: (state.metrics[metric] ?? 0) + amount };
  const completed = new Set(state.completedAchievementIds);
  pack.progression.achievements.forEach((achievement) => {
    if (achievement.metric === metric && (metrics[metric] ?? 0) >= achievement.threshold)
      completed.add(achievement.id);
  });
  return { ...state, metrics, completedAchievementIds: [...completed].sort() };
}

export function discoverCompendiumEntry(
  pack: PveContentPack,
  state: ProgressionState,
  entryId: string,
): ProgressionState {
  if (!pack.progression.compendiumEntries.some((entry) => entry.id === entryId))
    throw new Error(`compendium entry not found: ${entryId}`);
  if (state.compendiumEntryIds.includes(entryId)) return state;
  return { ...state, compendiumEntryIds: [...state.compendiumEntryIds, entryId].sort() };
}
