import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { executeBattleCommands } from "@skymenders/battle-core";
import type { BattleState } from "@skymenders/battle-core";
import {
  createDailyBattleState,
  createDailyChallenge,
  isDailyBattleNode,
  scoreDailyResult,
} from "@skymenders/challenge-core";
import { hashCanonical } from "@skymenders/deterministic-runtime";
import type {
  GameRepository,
  LeaderboardCache,
  ReplaySubmissionRecord,
} from "@skymenders/game-server";
import { loadChallengeContent, MemoryGameRepository } from "@skymenders/game-server";
import { DAILY_REPLAY_SCHEMA_VERSION } from "@skymenders/protocol";
import type {
  BattleCommand,
  DailyChallengeDefinition,
  FinishDailyAttemptRequest,
} from "@skymenders/protocol";

import { loadWorkerConfig } from "../src/config.js";
import { WorkerHealthServer } from "../src/health-server.js";
import { ReplayVerificationProcessor } from "../src/replay-verification.processor.js";

const now = new Date("2026-07-22T08:00:00.000Z");
const content = loadChallengeContent(resolve(import.meta.dirname, "../../../content"));

class TrackingCache implements LeaderboardCache {
  public readonly invalidated: string[] = [];

  public get(_key: string): Promise<unknown> {
    return Promise.resolve(null);
  }
  public set(_key: string, _value: unknown, _ttlSeconds: number): Promise<void> {
    return Promise.resolve();
  }
  public invalidateChallenge(challengeId: string): Promise<void> {
    this.invalidated.push(challengeId);
    return Promise.resolve();
  }
  public close(): Promise<void> {
    return Promise.resolve();
  }
  public health(): Promise<void> {
    return Promise.resolve();
  }
}

describe("ReplayVerificationProcessor", () => {
  let repository: MemoryGameRepository;
  let cache: TrackingCache;
  let challenge: DailyChallengeDefinition;

  beforeEach(() => {
    repository = new MemoryGameRepository();
    cache = new TrackingCache();
    challenge = createDailyChallenge(content, {
      instant: now,
      timeZone: "Asia/Shanghai",
      seedSecret: "worker-test-daily-secret-with-thirty-two-bytes",
      rulesVersion: "0.5.0",
      contentVersion: "0.1.0",
    });
  });

  it("rejects a tampered score and never exposes it on the leaderboard", async () => {
    const { submission, accountId } = await arrangeSubmission(repository, challenge, true);
    const processor = new ReplayVerificationProcessor(repository, content, cache);
    const result = await processor.process({ submissionId: submission.id });
    expect(result).toMatchObject({ status: "rejected", rejectionCode: "SCORE_MISMATCH" });
    expect(await repository.getLeaderboardEntry(challenge.challengeId, accountId)).toBeNull();
    expect(cache.invalidated).toEqual([]);
    expect(await processor.process({ submissionId: submission.id })).toEqual(result);
  });

  it("publishes only a verified formal result and invalidates its cached page", async () => {
    const { submission, accountId } = await arrangeSubmission(repository, challenge, false);
    const processor = new ReplayVerificationProcessor(repository, content, cache, () => now);
    expect(await processor.process({ submissionId: submission.id })).toMatchObject({
      status: "verified",
    });
    const ranked = await repository.getLeaderboardEntry(challenge.challengeId, accountId);
    expect(ranked?.entry.accountId).toBe(accountId);
    expect(ranked?.entry.completionStatus).toBe("completed");
    expect(ranked?.entry.systemCode).toMatch(/^[\p{Script=Han}A-Z0-9-]+$/u);
    expect(cache.invalidated).toEqual([challenge.challengeId]);
  });

  it("fails retryably when a queued submission no longer exists", async () => {
    const processor = new ReplayVerificationProcessor(repository, content, cache, () => now);
    await expect(processor.process({ submissionId: crypto.randomUUID() })).rejects.toThrow(
      "was not found",
    );
  });
});

describe("worker configuration", () => {
  it("parses required endpoints and bounds concurrency", () => {
    expect(loadWorkerConfig({ DATABASE_URL: "postgres://db", REDIS_URL: "redis://cache" })).toEqual(
      {
        databaseUrl: "postgres://db",
        redisUrl: "redis://cache",
        concurrency: 2,
        healthHost: "127.0.0.1",
        healthPort: 3_002,
      },
    );
    expect(() =>
      loadWorkerConfig({
        DATABASE_URL: "postgres://db",
        REDIS_URL: "redis://cache",
        REPLAY_WORKER_CONCURRENCY: "0",
      }),
    ).toThrow();
  });

  it("publishes separate liveness and readiness signals", async () => {
    const health = new WorkerHealthServer();
    await health.listen("127.0.0.1", 0);
    const base = `http://127.0.0.1:${health.port()}`;
    try {
      expect(await (await fetch(`${base}/health/live`)).json()).toEqual({ status: "ok" });
      expect((await fetch(`${base}/health/ready`)).status).toBe(503);
      health.markReady();
      const ready = await fetch(`${base}/health/ready`);
      expect(ready.status).toBe(200);
      expect(await ready.json()).toEqual({ status: "ready" });
      expect((await fetch(`${base}/missing`)).status).toBe(404);
    } finally {
      await health.close();
    }
    expect(() => health.port()).toThrow("closed");
  });
});

async function arrangeSubmission(
  repository: GameRepository,
  challenge: DailyChallengeDefinition,
  tamperScore: boolean,
): Promise<{ readonly submission: ReplaySubmissionRecord; readonly accountId: string }> {
  const account = await repository.findOrCreateAccount("wechat", crypto.randomUUID(), now);
  await repository.ensureDailyChallenge({
    id: challenge.challengeId,
    definition: challenge,
    createdAt: now,
  });
  const attemptId = crypto.randomUUID();
  const attempt = await repository.createFormalAttempt({
    id: attemptId,
    accountId: account.id,
    challengeId: challenge.challengeId,
    mode: "formal",
    formalSlot: 1,
    status: "active",
    checkpointIndex: null,
    checkpoint: null,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  });
  if (attempt === null) throw new Error("could not arrange formal attempt");
  const valid = makeWinningSubmission(challenge);
  const request = tamperScore ? { ...valid, claimedScore: valid.claimedScore + 1 } : valid;
  const submission = await repository.submitDailyAttempt(account.id, attemptId, request, now);
  if (submission === null) throw new Error("could not arrange replay submission");
  return { submission, accountId: account.id };
}

function makeWinningSubmission(challenge: DailyChallengeDefinition): FinishDailyAttemptRequest {
  const finalStates: BattleState[] = [];
  const nodeReplays = challenge.route.filter(isDailyBattleNode).map((node, index) => {
    const initial = createDailyBattleState(content, challenge, node.nodeId);
    const player = initial.actors.find((actor) => actor.team === "player");
    const primary = initial.objectives.find((objective) => objective.role === "primary");
    const targetId = primary?.targetId;
    if (player === undefined || targetId === undefined || targetId === null)
      throw new Error("daily challenge fixture is incomplete");
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
    submissionId: crypto.randomUUID(),
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
