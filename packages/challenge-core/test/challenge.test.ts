import { describe, expect, it } from "vitest";

import { executeAiEnemyPhase } from "@skymenders/ai-core";
import { executeBattleCommands } from "@skymenders/battle-core";
import type { BattleState } from "@skymenders/battle-core";
import { hashCanonical } from "@skymenders/deterministic-runtime";
import type { BattleCommand, FinishDailyAttemptRequest } from "@skymenders/protocol";
import { DAILY_REPLAY_SCHEMA_VERSION } from "@skymenders/protocol";

import {
  businessDateAt,
  createDailyAiState,
  createDailyBattleState,
  createDailyChallenge,
  isDailyBattleNode,
  nextBusinessReset,
  scoreDailyResult,
  verifyDailySubmission,
} from "../src/index.js";
import { loadPack } from "./fixture.js";

const pack = loadPack();
const options = {
  instant: new Date("2026-07-22T15:59:59.000Z"),
  timeZone: "Asia/Shanghai",
  seedSecret: "daily-challenge-test-secret-with-32-bytes",
  rulesVersion: "0.5.0",
  contentVersion: "0.1.0",
};

describe("daily challenge authority", () => {
  it("uses the configured business timezone and changes only at server midnight", () => {
    expect(businessDateAt(options.instant, options.timeZone)).toBe("2026-07-22");
    expect(nextBusinessReset(options.instant, options.timeZone).toISOString()).toBe(
      "2026-07-22T16:00:00.000Z",
    );
    expect(businessDateAt(new Date("2026-07-22T16:00:00.000Z"), options.timeZone)).toBe(
      "2026-07-23",
    );
  });

  it("freezes identical daily content and isolates another day", () => {
    const first = createDailyChallenge(pack, options);
    const repeated = createDailyChallenge(pack, {
      ...options,
      instant: new Date("2026-07-22T08:00:00Z"),
    });
    const next = createDailyChallenge(pack, {
      ...options,
      instant: new Date("2026-07-22T16:00:00Z"),
    });
    expect(repeated).toEqual(first);
    expect(first.route).toHaveLength(12);
    expect(new Set(first.loadouts.map((entry) => entry.robotId)).size).toBe(3);
    expect(next.challengeId).not.toBe(first.challengeId);
    expect(next.seed).not.toBe(first.seed);
  });

  it("fails closed when challenge inputs or authored battle references are unavailable", () => {
    expect(() => createDailyChallenge(pack, { ...options, seedSecret: "short" })).toThrow(
      "too short",
    );
    expect(() =>
      createDailyChallenge(
        { ...pack, robots: { ...pack.robots, contentVersion: "9.9.9" } },
        options,
      ),
    ).toThrow("content version");
    const challenge = createDailyChallenge(pack, options);
    expect(() => createDailyBattleState(pack, challenge, "missing-node")).toThrow("no battle map");
    expect(() =>
      createDailyAiState(
        challenge,
        "missing-node",
        createDailyBattleState(
          pack,
          challenge,
          challenge.route.find(isDailyBattleNode)?.nodeId ?? "missing",
        ),
      ),
    ).toThrow("unavailable");
    const battleNode = challenge.route.find(isDailyBattleNode);
    if (battleNode === undefined) throw new Error("daily fixture has no battle node");
    expect(() =>
      createDailyBattleState(
        pack,
        {
          ...challenge,
          route: challenge.route.map((node) =>
            node.nodeId === battleNode.nodeId ? { ...node, mapId: "missing-map" } : node,
          ),
        },
        battleNode.nodeId,
      ),
    ).toThrow("unavailable");
  });

  it("regenerates initial states, verifies commands, and rejects claimed-score tampering", () => {
    const challenge = createDailyChallenge(pack, options);
    const valid = makeWinningSubmission(challenge);
    const verified = verifyDailySubmission(pack, challenge, valid);
    expect(verified).toMatchObject({ status: "verified", score: valid.claimedScore });
    expect(
      verifyDailySubmission(pack, challenge, { ...valid, claimedScore: valid.claimedScore + 1 }),
    ).toMatchObject({
      status: "rejected",
      rejectionCode: "SCORE_MISMATCH",
    });
    expect(
      verifyDailySubmission(pack, challenge, { ...valid, seed: (valid.seed + 1) >>> 0 }),
    ).toMatchObject({ status: "rejected", rejectionCode: "CHALLENGE_MISMATCH" });
    expect(
      verifyDailySubmission(pack, challenge, { ...valid, completedNodeIds: [] }),
    ).toMatchObject({ status: "rejected", rejectionCode: "INCOMPLETE_ROUTE" });
    expect(
      verifyDailySubmission(pack, challenge, {
        ...valid,
        completedNodeIds: valid.completedNodeIds.slice(0, -1),
      }),
    ).toMatchObject({ status: "rejected", rejectionCode: "INCOMPLETE_ROUTE" });
    expect(
      verifyDailySubmission(pack, challenge, {
        ...valid,
        completionStatus: "failed",
      }),
    ).toMatchObject({ status: "rejected", rejectionCode: "INCOMPLETE_ROUTE" });

    const nonBattleIndex = challenge.route.findIndex((node) => !isDailyBattleNode(node));
    expect(nonBattleIndex).toBeGreaterThanOrEqual(0);
    if (nonBattleIndex >= 0) {
      expect(
        verifyDailySubmission(pack, challenge, {
          ...valid,
          completionStatus: "failed",
          completedNodeIds: challenge.route.slice(0, nonBattleIndex).map((node) => node.nodeId),
          nodeReplays: [],
        }),
      ).toMatchObject({ status: "rejected", rejectionCode: "INCOMPLETE_ROUTE" });
    }

    const failedBattleIndex = challenge.route.findIndex(isDailyBattleNode);
    expect(failedBattleIndex).toBeGreaterThanOrEqual(0);
    const failedBattleNode = challenge.route[failedBattleIndex];
    const failedBattleReplay = valid.nodeReplays.find(
      (replay) => replay.nodeId === failedBattleNode?.nodeId,
    );
    if (failedBattleNode !== undefined && failedBattleReplay !== undefined) {
      expect(
        verifyDailySubmission(pack, challenge, {
          ...valid,
          completionStatus: "failed",
          completedNodeIds: challenge.route.slice(0, failedBattleIndex).map((node) => node.nodeId),
          nodeReplays: [failedBattleReplay],
        }),
      ).toMatchObject({ status: "rejected", rejectionCode: "INCOMPLETE_ROUTE" });
    }
    const first = valid.nodeReplays[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    const corrupted = {
      ...valid,
      nodeReplays: [
        { ...first, finalStateHash: "0000000000000000" },
        ...valid.nodeReplays.slice(1),
      ],
    };
    expect(verifyDailySubmission(pack, challenge, corrupted)).toMatchObject({
      status: "rejected",
      rejectionCode: "FINAL_HASH_MISMATCH",
    });
    expect(
      verifyDailySubmission(pack, challenge, {
        ...valid,
        nodeReplays: [
          { ...first, initialStateHash: "0000000000000000" },
          ...valid.nodeReplays.slice(1),
        ],
      }),
    ).toMatchObject({ status: "rejected", rejectionCode: "REPLAY_INVALID" });
    expect(
      verifyDailySubmission(pack, challenge, {
        ...valid,
        nodeReplays: [
          {
            ...first,
            checkpoints: first.checkpoints.map((checkpoint, index) =>
              index === 0 ? { ...checkpoint, stateHash: "0000000000000000" } : checkpoint,
            ),
          },
          ...valid.nodeReplays.slice(1),
        ],
      }),
    ).toMatchObject({ status: "rejected", rejectionCode: "CHECKPOINT_MISMATCH" });

    const battleNode = challenge.route.find(isDailyBattleNode);
    if (battleNode === undefined) throw new Error("daily fixture has no battle node");
    const initial = createDailyBattleState(pack, challenge, battleNode.nodeId);
    const preparation: BattleCommand[] = [
      {
        kind: "advance_phase",
        commandId: "prepare:planning",
        battleId: initial.battleId,
        turnIndex: 0,
        actorId: "system",
        expectedPhase: "player_planning",
      },
      ...initial.actors
        .filter((actor) => actor.team === "player")
        .map((actor, index): BattleCommand => ({
          kind: "wait",
          commandId: `prepare:wait:${index}`,
          battleId: initial.battleId,
          turnIndex: 0,
          actorId: actor.id,
        })),
      {
        kind: "advance_phase",
        commandId: "prepare:player-action",
        battleId: initial.battleId,
        turnIndex: 0,
        actorId: "system",
        expectedPhase: "player_action",
      },
    ];
    const prepared = executeBattleCommands(initial, preparation).finalState;
    const ai = createDailyAiState(challenge, battleNode.nodeId, prepared);
    const planned = executeAiEnemyPhase(prepared, ai, preparation.length).commands[0];
    if (planned === undefined) throw new Error("daily fixture AI produced no command");
    const forgedReplay = {
      nodeId: battleNode.nodeId,
      initialStateHash: hashCanonical(initial),
      commands: [...preparation, { ...planned, commandId: "client-selected-enemy-action" }],
      checkpoints: [],
      finalStateHash: "0000000000000000",
    };
    expect(
      verifyDailySubmission(pack, challenge, {
        ...valid,
        nodeReplays: [
          forgedReplay,
          ...valid.nodeReplays.filter((replay) => replay.nodeId !== battleNode.nodeId),
        ],
      }),
    ).toMatchObject({ status: "rejected", rejectionCode: "REPLAY_INVALID" });
  });

  it("scores an empty result as zero", () => {
    expect(scoreDailyResult([])).toBe(0);
  });
});

function makeWinningSubmission(
  challenge: ReturnType<typeof createDailyChallenge>,
): FinishDailyAttemptRequest {
  const finalStates: BattleState[] = [];
  const nodeReplays = challenge.route.filter(isDailyBattleNode).map((node, index) => {
    const initial = createDailyBattleState(pack, challenge, node.nodeId);
    const player = initial.actors.find((actor) => actor.team === "player");
    const primary = initial.objectives.find((objective) => objective.role === "primary");
    if (player === undefined || primary?.targetId === null || primary === undefined)
      throw new Error("daily fixture is missing a player or primary target");
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
        targetId: primary.targetId,
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
