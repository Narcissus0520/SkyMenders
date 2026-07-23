import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createDailyChallenge } from "@skymenders/challenge-core";
import {
  BullMqReplayVerificationQueue,
  loadChallengeContent,
  MemoryGameRepository,
  MemoryLeaderboardCache,
} from "@skymenders/game-server";
import { DAILY_REPLAY_SCHEMA_VERSION } from "@skymenders/protocol";

import { ReplayVerificationProcessor } from "../src/replay-verification.processor.js";
import { ReplayWorkerRuntime } from "../src/worker-runtime.js";

const redisUrl = process.env.REDIS_URL;

describe.runIf(redisUrl !== undefined)("BullMQ replay verification", () => {
  it("delivers an idempotent submission to the authority worker", async () => {
    if (redisUrl === undefined) throw new Error("REDIS_URL is required");
    const repository = new MemoryGameRepository();
    const cache = new MemoryLeaderboardCache();
    const content = loadChallengeContent(resolve(import.meta.dirname, "../../../content"));
    const now = new Date("2026-07-22T08:00:00.000Z");
    const challenge = createDailyChallenge(content, {
      instant: now,
      timeZone: "Asia/Shanghai",
      seedSecret: "redis-integration-secret-with-thirty-two-bytes",
      rulesVersion: "0.6.0",
      contentVersion: "0.2.0",
    });
    const account = await repository.findOrCreateAccount("wechat", crypto.randomUUID(), now);
    await repository.ensureDailyChallenge({
      id: challenge.challengeId,
      definition: challenge,
      createdAt: now,
    });
    const attemptId = crypto.randomUUID();
    await repository.createFormalAttempt({
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
    const submissionId = crypto.randomUUID();
    const submission = await repository.submitDailyAttempt(
      account.id,
      attemptId,
      {
        submissionId,
        challengeId: challenge.challengeId,
        seed: challenge.seed,
        rulesVersion: challenge.rulesVersion,
        contentVersion: challenge.contentVersion,
        replaySchemaVersion: DAILY_REPLAY_SCHEMA_VERSION,
        clientVersion: "0.5.0",
        claimedScore: 1_000_000,
        completionMs: 1,
        recoveryCount: 0,
        completionStatus: "completed",
        completedNodeIds: [],
        nodeReplays: [],
      },
      now,
    );
    expect(submission?.status).toBe("queued");

    const processor = new ReplayVerificationProcessor(repository, content, cache, () => now);
    const runtime = new ReplayWorkerRuntime(redisUrl, processor, 1);
    const queue = new BullMqReplayVerificationQueue(redisUrl);
    try {
      await runtime.ready();
      await queue.enqueue(submissionId);
      const terminal = await waitForTerminal(repository, submissionId);
      expect(terminal).toMatchObject({ status: "rejected", rejectionCode: "INCOMPLETE_ROUTE" });
      expect(await repository.getLeaderboardEntry(challenge.challengeId, account.id)).toBeNull();
    } finally {
      await queue.close();
      await runtime.close();
      await cache.close();
      await repository.close();
    }
  }, 15_000);
});

async function waitForTerminal(repository: MemoryGameRepository, submissionId: string) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const submission = await repository.getReplaySubmission(submissionId);
    if (submission?.status === "verified" || submission?.status === "rejected") return submission;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error("replay verification job did not finish before the deadline");
}
