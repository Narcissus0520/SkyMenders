import { describe, expect, it } from "vitest";

import {
  DAILY_REPLAY_SCHEMA_VERSION,
  dailyChallengeDefinitionSchema,
  dailyChallengeResponseSchema,
  finishDailyAttemptRequestSchema,
  leaderboardEntrySchema,
} from "../src/index.js";

describe("daily challenge protocol", () => {
  it("accepts a frozen server-owned definition", () => {
    const challenge = dailyChallengeDefinitionSchema.parse({
      challengeId: "2026-07-22:0.5.0:0.1.0:42",
      businessDate: "2026-07-22",
      resetsAt: "2026-07-22T16:00:00.000Z",
      seed: 42,
      rulesVersion: "0.5.0",
      contentVersion: "0.1.0",
      replaySchemaVersion: DAILY_REPLAY_SCHEMA_VERSION,
      difficulty: "hard",
      initialEnergy: 12,
      initialHp: 100,
      loadouts: ["rivet", "anchor", "gale"].map((robotId) => ({
        robotId: `robot_${robotId}`,
        mainModuleId: "main_fold_bridge",
        auxiliaryModuleIds: ["aux_repair_spray", "aux_stabilizer"],
      })),
      route: [
        {
          nodeId: "region_1_layer_0_node_0",
          type: "battle",
          mapId: "map_cloudbreak_relay",
          eventId: null,
          bossId: null,
          rewardSeed: 7,
        },
      ],
      definitionHash: "0123456789abcdef",
    });
    expect(challenge.seed).toBe(42);
    expect(challenge.loadouts).toHaveLength(3);
    expect(() =>
      dailyChallengeResponseSchema.parse({
        challenge,
        formalAttemptsRemaining: 3,
        formalUnlocked: false,
        activeAttemptId: null,
        activeAttempt: null,
      }),
    ).not.toThrow();
  });

  it("rejects client dates, unknown replay fields, and personal leaderboard fields", () => {
    expect(() =>
      finishDailyAttemptRequestSchema.parse({
        submissionId: "019f89fe-cbbf-7f56-a9e7-77633e9b5dc8",
        challengeId: "2026-07-22:0.5.0:0.1.0:42",
        seed: 42,
        rulesVersion: "0.5.0",
        contentVersion: "0.1.0",
        replaySchemaVersion: DAILY_REPLAY_SCHEMA_VERSION,
        clientVersion: "0.4.0",
        claimedScore: 0,
        completionMs: 10,
        recoveryCount: 0,
        completionStatus: "failed",
        completedNodeIds: [],
        nodeReplays: [],
        businessDate: "2099-01-01",
      }),
    ).toThrow();
    expect(
      leaderboardEntrySchema.parse({
        rank: 1,
        systemCode: "远帆铆工-3943",
        avatarId: "avatar_robot_rivet",
        score: 90_000,
        completionMs: 1_000,
        turns: 5,
        completionStatus: "completed",
      }).systemCode,
    ).toBe("远帆铆工-3943");
    expect(() =>
      leaderboardEntrySchema.parse({
        rank: 1,
        systemCode: "SKY-ABCD",
        avatarId: "avatar_robot_rivet",
        score: 90_000,
        completionMs: 1_000,
        turns: 5,
        completionStatus: "completed",
        openId: "must-never-appear",
      }),
    ).toThrow();
  });
});
