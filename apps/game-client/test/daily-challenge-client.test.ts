import { describe, expect, it } from "vitest";

import { DAILY_REPLAY_SCHEMA_VERSION } from "@skymenders/protocol";
import type { DailyChallengeDefinition, FinishDailyAttemptRequest } from "@skymenders/protocol";

import {
  AuthSessionManager,
  DailyChallengeClient,
  MockPlatformAdapter,
} from "../assets/scripts/index.js";
import type { JsonRequest, JsonResponse, JsonTransport } from "../assets/scripts/index.js";

class ScriptedTransport implements JsonTransport {
  public readonly requests: JsonRequest[] = [];

  public constructor(private readonly responses: JsonResponse[]) {}

  public request(input: JsonRequest): Promise<JsonResponse> {
    this.requests.push(structuredClone(input));
    const response = this.responses.shift();
    if (response === undefined) throw new Error("scripted response is missing");
    return Promise.resolve(response);
  }
}

const attemptId = "018f0f40-7b1a-7000-8000-000000000011";
const submissionId = "018f0f40-7b1a-7000-8000-000000000012";
const challenge: DailyChallengeDefinition = {
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
  loadouts: ["rivet", "anchor", "gale"].map((name) => ({
    robotId: `robot_${name}`,
    mainModuleId: "main_fold_bridge",
    auxiliaryModuleIds: ["aux_repair_spray", "aux_stabilizer"],
  })) as DailyChallengeDefinition["loadouts"],
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
};

describe("DailyChallengeClient", () => {
  it("uses server-owned challenge data across the full attempt and leaderboard API", async () => {
    const transport = new ScriptedTransport([
      session(),
      ok({
        challenge,
        formalAttemptsRemaining: 3,
        formalUnlocked: true,
        activeAttemptId: null,
        activeAttempt: null,
      }),
      ok(start("practice")),
      ok(start("formal")),
      ok({ attemptId, checkpointIndex: 1, acceptedAt: "2026-07-22T08:01:00.000Z" }),
      ok({ attemptId, submissionId, status: "queued" }),
      ok({ attemptId, status: "abandoned" }),
      ok({
        challengeId: challenge.challengeId,
        entries: [
          {
            rank: 1,
            systemCode: "远帆铆工-3943",
            avatarId: "avatar_robot_rivet",
            score: 90_000,
            completionMs: 180_000,
            turns: 9,
            completionStatus: "completed",
          },
        ],
        nextCursor: null,
      }),
      ok({ challengeId: challenge.challengeId, entry: null }),
    ]);
    const sessions = new AuthSessionManager(new MockPlatformAdapter(), transport);
    await sessions.login();
    const client = new DailyChallengeClient(sessions);

    expect((await client.getDaily()).challenge.businessDate).toBe("2026-07-22");
    expect((await client.startPractice("daily-practice-1")).mode).toBe("practice");
    expect((await client.startFormal("daily-formal-1")).mode).toBe("formal");
    await client.checkpoint(
      attemptId,
      {
        checkpointIndex: 1,
        commandCount: 2,
        stateHash: "0123456789abcdef",
        recoveryCount: 0,
        payload: { nodeId: "region_1_layer_0_node_0" },
      },
      "daily-checkpoint-1",
    );
    await client.finish(attemptId, submission(), "daily-finish-1");
    await client.abandon(attemptId, "daily-abandon-1");
    expect((await client.leaderboard("page-2", 20)).entries[0]?.systemCode).toBe("远帆铆工-3943");
    expect((await client.leaderboardMe()).entry).toBeNull();

    expect(transport.requests.map((request) => request.path).slice(1)).toEqual([
      "/v1/challenges/daily",
      "/v1/challenges/daily/practice/start",
      "/v1/challenges/daily/attempts/start",
      `/v1/challenges/daily/attempts/${attemptId}/checkpoint`,
      `/v1/challenges/daily/attempts/${attemptId}/finish`,
      `/v1/challenges/daily/attempts/${attemptId}/abandon`,
      "/v1/leaderboards/daily?limit=20&cursor=page-2",
      "/v1/leaderboards/daily/me",
    ]);
    const dailyRequests = transport.requests.slice(1);
    expect(JSON.stringify(dailyRequests)).not.toContain("businessDate");
    expect(dailyRequests[4]?.body).toMatchObject({
      challengeId: challenge.challengeId,
      seed: challenge.seed,
      rulesVersion: challenge.rulesVersion,
      contentVersion: challenge.contentVersion,
    });
  });

  it("rejects non-success responses and privacy-unsafe leaderboard payloads", async () => {
    const failedTransport = new ScriptedTransport([session(), { status: 503, body: {} }]);
    const failedSessions = new AuthSessionManager(new MockPlatformAdapter(), failedTransport);
    await failedSessions.login();
    await expect(new DailyChallengeClient(failedSessions).getDaily()).rejects.toThrow("status 503");

    const unsafeTransport = new ScriptedTransport([
      session(),
      ok({
        challengeId: challenge.challengeId,
        entries: [
          {
            rank: 1,
            systemCode: "远帆铆工-3943",
            avatarId: "avatar_robot_rivet",
            score: 90_000,
            completionMs: 180_000,
            turns: 9,
            completionStatus: "completed",
            openId: "must-not-cross-client-boundary",
          },
        ],
        nextCursor: null,
      }),
    ]);
    const unsafeSessions = new AuthSessionManager(new MockPlatformAdapter(), unsafeTransport);
    await unsafeSessions.login();
    await expect(new DailyChallengeClient(unsafeSessions).leaderboard()).rejects.toThrow();
  });
});

function start(mode: "practice" | "formal") {
  return {
    attemptId,
    challenge,
    mode,
    status: "active",
    formalAttemptsRemaining: 2,
    checkpoint: null,
  };
}

function submission(): FinishDailyAttemptRequest {
  return {
    submissionId,
    challengeId: challenge.challengeId,
    seed: challenge.seed,
    rulesVersion: challenge.rulesVersion,
    contentVersion: challenge.contentVersion,
    replaySchemaVersion: DAILY_REPLAY_SCHEMA_VERSION,
    clientVersion: "0.4.0",
    claimedScore: 0,
    completionMs: 1,
    recoveryCount: 0,
    completionStatus: "failed",
    completedNodeIds: [],
    nodeReplays: [],
  };
}

function session(): JsonResponse {
  return ok({
    accessToken: `access-${"x".repeat(40)}`,
    accessExpiresAt: "2026-07-22T08:15:00.000Z",
    refreshToken: "r".repeat(43),
    refreshExpiresAt: "2026-08-21T08:00:00.000Z",
    accountId: "018f0f40-7b1a-7000-8000-000000000001",
  });
}

function ok(body: unknown): JsonResponse {
  return { status: 200, body };
}
