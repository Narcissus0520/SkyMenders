import { planAiAction } from "@skymenders/ai-core";
import type { AiAuthorityState } from "@skymenders/ai-core";
import { reduceBattleCommand, terrainIntegrityPermille } from "@skymenders/battle-core";
import type { BattleState } from "@skymenders/battle-core";
import type { PveContentPack } from "@skymenders/content-schema";
import { hashCanonical } from "@skymenders/deterministic-runtime";
import type {
  DailyChallengeDefinition,
  FinishDailyAttemptRequest,
  ReplayVerificationResult,
} from "@skymenders/protocol";

import { createDailyAiState, createDailyBattleState, isDailyBattleNode } from "./challenge.js";

export function verifyDailySubmission(
  pack: PveContentPack,
  challenge: DailyChallengeDefinition,
  submission: FinishDailyAttemptRequest,
): ReplayVerificationResult {
  try {
    if (
      submission.challengeId !== challenge.challengeId ||
      submission.seed !== challenge.seed ||
      submission.rulesVersion !== challenge.rulesVersion ||
      submission.contentVersion !== challenge.contentVersion
    )
      return rejected(submission.submissionId, "CHALLENGE_MISMATCH");
    const requiredNodes = expectedReplayNodes(challenge, submission);
    if (requiredNodes === null) return rejected(submission.submissionId, "INCOMPLETE_ROUTE");
    const finalStates: BattleState[] = [];
    for (const node of requiredNodes) {
      const replay = submission.nodeReplays.find((candidate) => candidate.nodeId === node.nodeId);
      if (replay === undefined) return rejected(submission.submissionId, "INCOMPLETE_ROUTE");
      const initialState = createDailyBattleState(pack, challenge, node.nodeId);
      if (hashCanonical(initialState) !== replay.initialStateHash)
        return rejected(submission.submissionId, "REPLAY_INVALID");
      let execution;
      try {
        execution = executeAuthorityCommands(
          initialState,
          createDailyAiState(challenge, node.nodeId, initialState),
          replay.commands,
        );
      } catch {
        return rejected(submission.submissionId, "REPLAY_INVALID");
      }
      if (!sameCheckpoints(execution.checkpoints, replay.checkpoints))
        return rejected(submission.submissionId, "CHECKPOINT_MISMATCH");
      if (hashCanonical(execution.finalState) !== replay.finalStateHash)
        return rejected(submission.submissionId, "FINAL_HASH_MISMATCH");
      const expectedOutcome = submission.completedNodeIds.includes(node.nodeId)
        ? "victory"
        : "defeat";
      if (execution.finalState.outcome.status !== expectedOutcome)
        return rejected(submission.submissionId, "INCOMPLETE_ROUTE");
      finalStates.push(execution.finalState);
    }
    const score = scoreDailyResult(finalStates);
    if (score !== submission.claimedScore)
      return rejected(submission.submissionId, "SCORE_MISMATCH");
    return {
      submissionId: submission.submissionId,
      status: "verified",
      score,
      totalTurns: finalStates.reduce((total, state) => total + state.turnIndex, 0),
      rejectionCode: null,
    };
  } catch {
    return rejected(submission.submissionId, "REPLAY_INVALID");
  }
}

function executeAuthorityCommands(
  initialState: BattleState,
  initialAi: AiAuthorityState,
  commands: FinishDailyAttemptRequest["nodeReplays"][number]["commands"],
) {
  let state = initialState;
  let ai = initialAi;
  const checkpoints: { readonly commandIndex: number; readonly stateHash: string }[] = [];
  commands.forEach((command, commandIndex) => {
    if (state.phase === "enemy_action" && command.kind !== "advance_phase") {
      const expectedActor = state.actors
        .filter((actor) => actor.team === "enemy" && !actor.disabled && !actor.actionEnded)
        .map((actor) => actor.id)
        .sort(compareText)[0];
      if (expectedActor === undefined || command.actorId !== expectedActor)
        throw new Error("submitted enemy action order is not authoritative");
      const decision = planAiAction(state, ai, expectedActor);
      if (hashCanonical(decision.command) !== hashCanonical(command))
        throw new Error("submitted enemy command differs from authoritative AI");
      ai = decision.state;
    }
    state = reduceBattleCommand(state, command, commandIndex).state;
    checkpoints.push({ commandIndex, stateHash: hashCanonical(state) });
  });
  return { finalState: state, checkpoints };
}

export function scoreDailyResult(finalStates: readonly BattleState[]): number {
  if (finalStates.length === 0) return 0;
  const average = (values: readonly number[]): number =>
    Math.trunc(values.reduce((total, value) => total + value, 0) / values.length);
  const primaryPermille = average(
    finalStates.map((state) => {
      const primary = state.objectives.filter((objective) => objective.role === "primary");
      if (primary.length === 0) return 0;
      return Math.trunc(
        (primary.filter((objective) => objective.status === "completed").length * 1_000) /
          primary.length,
      );
    }),
  );
  const objectivePermille = average(
    finalStates.map((state) => {
      const optional = state.objectives.filter((objective) => objective.role !== "primary");
      if (optional.length === 0) return 0;
      return Math.trunc(
        (optional.filter((objective) => objective.status === "completed").length * 1_000) /
          optional.length,
      );
    }),
  );
  const remainingPermille = average(
    finalStates.map((state) => {
      const players = state.actors.filter((actor) => actor.team === "player");
      const hp = players.reduce((total, actor) => total + Math.max(0, actor.hp), 0);
      const maximum = players.reduce((total, actor) => total + actor.maxHp, 0);
      return maximum === 0 ? 0 : Math.trunc((hp * 1_000) / maximum);
    }),
  );
  const terrainPermille = average(
    finalStates.map((state) =>
      terrainIntegrityPermille(state.terrain, state.statistics.terrainInitialIntegrity),
    ),
  );
  const turns = finalStates.reduce((total, state) => total + state.turnIndex, 0);
  const turnPermille = Math.max(0, 1_000 - Math.max(0, turns - finalStates.length) * 25);
  const energyPermille = average(
    finalStates.map((state) => Math.trunc((state.energy.current * 1_000) / state.energy.maximum)),
  );
  return (
    Math.trunc((primaryPermille * 40_000) / 1_000) +
    Math.trunc((objectivePermille * 20_000) / 1_000) +
    Math.trunc((remainingPermille * 15_000) / 1_000) +
    Math.trunc((terrainPermille * 10_000) / 1_000) +
    Math.trunc((turnPermille * 10_000) / 1_000) +
    Math.trunc((energyPermille * 5_000) / 1_000)
  );
}

function expectedReplayNodes(
  challenge: DailyChallengeDefinition,
  submission: FinishDailyAttemptRequest,
): DailyChallengeDefinition["route"] | null {
  const routeIds = challenge.route.map((node) => node.nodeId);
  const isPrefix = submission.completedNodeIds.every((nodeId, index) => routeIds[index] === nodeId);
  if (!isPrefix || new Set(submission.completedNodeIds).size !== submission.completedNodeIds.length)
    return null;
  let expected: DailyChallengeDefinition["route"];
  if (submission.completionStatus === "completed") {
    if (submission.completedNodeIds.length !== challenge.route.length) return null;
    expected = challenge.route.filter(isDailyBattleNode);
  } else {
    const failedNode = challenge.route[submission.completedNodeIds.length];
    if (failedNode === undefined || !isDailyBattleNode(failedNode)) return null;
    expected = [
      ...challenge.route.slice(0, submission.completedNodeIds.length).filter(isDailyBattleNode),
      failedNode,
    ];
  }
  return sameSet(
    submission.nodeReplays.map((replay) => replay.nodeId),
    expected.map((node) => node.nodeId),
  )
    ? expected
    : null;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameCheckpoints(
  actual: readonly { readonly commandIndex: number; readonly stateHash: string }[],
  expected: readonly { readonly commandIndex: number; readonly stateHash: string }[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((checkpoint, index) => {
      const expectedCheckpoint = expected[index];
      return (
        checkpoint.commandIndex === expectedCheckpoint?.commandIndex &&
        checkpoint.stateHash === expectedCheckpoint.stateHash
      );
    })
  );
}

function rejected(
  submissionId: string,
  rejectionCode: NonNullable<ReplayVerificationResult["rejectionCode"]>,
): ReplayVerificationResult {
  return { submissionId, status: "rejected", score: null, totalTurns: null, rejectionCode };
}
