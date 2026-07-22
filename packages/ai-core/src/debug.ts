import type { BattleCommand } from "@skymenders/protocol";

import type { AiDebugMarker, AiDebugView, AiDecisionTrace } from "./types.js";

export function createAiDebugView(trace: AiDecisionTrace): AiDebugView {
  const candidates = [...trace.candidates].sort(
    (left, right) =>
      Number(right.legal) - Number(left.legal) ||
      right.weightedScore - left.weightedScore ||
      compareText(left.candidateId, right.candidateId),
  );
  const markers: AiDebugMarker[] = candidates.flatMap((candidate) => {
    const point = commandPoint(candidate.command);
    return point === null
      ? []
      : [
          {
            candidateId: candidate.candidateId,
            ...point,
            selected: candidate.candidateId === trace.selectedCandidateId,
            score: candidate.weightedScore,
          },
        ];
  });
  return {
    title: `${trace.actorId} turn=${trace.turnIndex} decision=${trace.decisionIndex} difficulty=${trace.difficulty}`,
    goal: trace.selectedGoal,
    behaviorRows: trace.behaviorTrace.map(
      (entry) => `${entry.status === "success" ? "+" : "-"} ${entry.kind} ${entry.nodeId}`,
    ),
    candidateRows: candidates.map(
      (candidate) =>
        `${candidate.candidateId === trace.selectedCandidateId ? ">" : " "} ${candidate.candidateId} ${candidate.command.kind} ${candidate.legal ? candidate.weightedScore : `REJECT ${candidate.rejection ?? "unknown"}`}`,
    ),
    markers,
  };
}

export function renderAiDebugText(trace: AiDecisionTrace): string {
  const view = createAiDebugView(trace);
  return [
    view.title,
    `goal=${view.goal} score=${trace.selectedScore} aim=${trace.angleErrorMilliDegrees}/${trace.powerErrorPermille}`,
    "behavior:",
    ...view.behaviorRows.map((row) => `  ${row}`),
    "candidates:",
    ...view.candidateRows.map((row) => `  ${row}`),
  ].join("\n");
}

function commandPoint(command: BattleCommand): { readonly x: number; readonly y: number } | null {
  if (command.kind === "move") return { x: command.destinationX, y: command.destinationY };
  if (
    (command.kind === "use_module" || command.kind === "use_basic_action") &&
    command.targetX !== undefined &&
    command.targetY !== undefined
  ) {
    return { x: command.targetX, y: command.targetY };
  }
  return null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
