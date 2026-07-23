import { performance } from "node:perf_hooks";

import { executeBattleCommands } from "@skymenders/battle-core";
import type { BattleState } from "@skymenders/battle-core";
import { hashCanonical } from "@skymenders/deterministic-runtime";
import { DAILY_REPLAY_SCHEMA_VERSION } from "@skymenders/protocol";
import type { BattleCommand, FinishDailyAttemptRequest } from "@skymenders/protocol";

import {
  createDailyBattleState,
  createDailyChallenge,
  isDailyBattleNode,
  scoreDailyResult,
  verifyDailySubmission,
} from "../src/index.js";
import { loadPack } from "../test/fixture.js";

const content = loadPack();
const challenge = createDailyChallenge(content, {
  instant: new Date("2026-07-22T08:00:00.000Z"),
  timeZone: "Asia/Shanghai",
  seedSecret: "verification-benchmark-secret-with-thirty-two-bytes",
  rulesVersion: "0.5.0",
  contentVersion: "0.1.0",
});
const submission = makeSubmission();
const durations: number[] = [];
for (let iteration = 0; iteration < 100; iteration += 1) {
  const started = performance.now();
  const result = verifyDailySubmission(content, challenge, submission);
  durations.push(performance.now() - started);
  if (result.status !== "verified") throw new Error("benchmark replay failed verification");
}
durations.sort((left, right) => left - right);
const percentile95 = durations[Math.ceil(durations.length * 0.95) - 1];
if (percentile95 === undefined || percentile95 > 100)
  throw new Error(`daily replay verification p95 exceeded 100 ms: ${String(percentile95)}`);
process.stdout.write(`daily replay verification p95: ${percentile95.toFixed(2)} ms (100 runs)\n`);

function makeSubmission(): FinishDailyAttemptRequest {
  const finalStates: BattleState[] = [];
  const nodeReplays = challenge.route.filter(isDailyBattleNode).map((node, index) => {
    const initial = createDailyBattleState(content, challenge, node.nodeId);
    const player = initial.actors.find((actor) => actor.team === "player");
    const targetId = initial.objectives.find((objective) => objective.role === "primary")?.targetId;
    if (player === undefined || targetId === undefined || targetId === null)
      throw new Error("benchmark fixture is incomplete");
    const commands: BattleCommand[] = [
      {
        kind: "advance_phase",
        commandId: `advance:${index}`,
        battleId: initial.battleId,
        turnIndex: 0,
        actorId: "system",
        expectedPhase: "player_planning",
      },
      {
        kind: "interact",
        commandId: `interact:${index}`,
        battleId: initial.battleId,
        turnIndex: 0,
        actorId: player.id,
        targetId,
      },
    ];
    const execution = executeBattleCommands(initial, commands);
    finalStates.push(execution.finalState);
    return {
      nodeId: node.nodeId,
      initialStateHash: hashCanonical(initial),
      commands,
      checkpoints: [...execution.checkpoints],
      finalStateHash: hashCanonical(execution.finalState),
    };
  });
  return {
    submissionId: "019f89fe-cbbf-7f56-a9e7-77633e9b5dc8",
    challengeId: challenge.challengeId,
    seed: challenge.seed,
    rulesVersion: challenge.rulesVersion,
    contentVersion: challenge.contentVersion,
    replaySchemaVersion: DAILY_REPLAY_SCHEMA_VERSION,
    clientVersion: "0.5.0",
    claimedScore: scoreDailyResult(finalStates),
    completionMs: 180_000,
    recoveryCount: 0,
    completionStatus: "completed",
    completedNodeIds: challenge.route.map((node) => node.nodeId),
    nodeReplays,
  };
}
