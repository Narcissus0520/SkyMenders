import type { PveContentPack } from "@skymenders/content-schema";

import type { TutorialState } from "./types.js";

export function startTutorial(pack: PveContentPack, tutorialId: string): TutorialState {
  if (!pack.tutorials.tutorials.some((tutorial) => tutorial.id === tutorialId))
    throw new Error(`tutorial not found: ${tutorialId}`);
  return { tutorialId, stepIndex: 0, completed: false };
}

export function applyTutorialAction(
  pack: PveContentPack,
  state: TutorialState,
  validation: string,
): TutorialState {
  if (state.completed) return state;
  const tutorial = pack.tutorials.tutorials.find((candidate) => candidate.id === state.tutorialId);
  if (tutorial === undefined) throw new Error(`tutorial not found: ${state.tutorialId}`);
  const step = tutorial.steps[state.stepIndex];
  if (step === undefined) throw new Error("tutorial step is missing");
  if (step.validation !== validation)
    throw new Error(`tutorial action rejected: expected ${step.validation}`);
  const nextIndex = state.stepIndex + 1;
  return { ...state, stepIndex: nextIndex, completed: nextIndex === tutorial.steps.length };
}

export function canEnterStandardExpedition(
  pack: PveContentPack,
  completedTutorialIds: readonly string[],
): boolean {
  const finalTutorial = [...pack.tutorials.tutorials]
    .sort((left, right) => left.order - right.order)
    .at(-1);
  return finalTutorial !== undefined && completedTutorialIds.includes(finalTutorial.id);
}

export function canEnterRankedDailyChallenge(standardRegionsCompleted: number): boolean {
  return Number.isSafeInteger(standardRegionsCompleted) && standardRegionsCompleted >= 1;
}
