import { battleCommandSchema } from "./battle-command.js";
import { replayCheckpointSchema } from "./replay-file.js";
import { isoDateTimeSchema, jsonValueSchema, uuidSchema, z } from "./zod-compat.js";

export const DAILY_REPLAY_SCHEMA_VERSION = "0.2.0";

const semanticVersion = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const challengeId = z
  .string()
  .min(1)
  .max(240)
  .regex(/^\d{4}-\d{2}-\d{2}:\d+\.\d+\.\d+:[0-9A-Za-z.-]+:\d+$/);
const identifier = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const stateHash = z.string().regex(/^[0-9a-f]{16}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = isoDateTimeSchema;
const nonNegativeInteger = z.number().int().nonnegative();

export const dailyChallengeNodeSchema = z
  .object({
    nodeId: identifier,
    type: z.enum(["battle", "engineering", "elite", "event", "workshop", "supply", "boss"]),
    mapId: identifier.nullable(),
    eventId: identifier.nullable(),
    bossId: identifier.nullable(),
    rewardSeed: z.number().int().min(0).max(0xffff_ffff),
  })
  .strict();

export const dailyLoadoutSchema = z
  .object({
    robotId: identifier,
    mainModuleId: identifier,
    auxiliaryModuleIds: z.tuple([identifier, identifier]),
  })
  .strict();

export const dailyChallengeDefinitionSchema = z
  .object({
    challengeId,
    businessDate: isoDate,
    resetsAt: isoDateTime,
    seed: z.number().int().min(0).max(0xffff_ffff),
    rulesVersion: semanticVersion,
    contentVersion: semanticVersion,
    replaySchemaVersion: z.literal(DAILY_REPLAY_SCHEMA_VERSION),
    difficulty: z.enum(["normal", "hard", "expert"]),
    initialEnergy: z.number().int().min(0).max(1_000),
    initialHp: z.number().int().positive().max(10_000),
    loadouts: z.tuple([dailyLoadoutSchema, dailyLoadoutSchema, dailyLoadoutSchema]),
    route: z.array(dailyChallengeNodeSchema).min(1).max(32),
    definitionHash: stateHash,
  })
  .strict();

export const dailyAttemptModeSchema = z.enum(["practice", "formal"]);
export const dailyAttemptStatusSchema = z.enum([
  "active",
  "submitted",
  "verified",
  "rejected",
  "abandoned",
]);

export const dailyAttemptCheckpointRequestSchema = z
  .object({
    checkpointIndex: nonNegativeInteger.max(100_000),
    commandCount: nonNegativeInteger.max(1_000_000),
    stateHash,
    recoveryCount: nonNegativeInteger.max(100),
    payload: jsonValueSchema,
  })
  .strict();

export const dailyChallengeResponseSchema = z
  .object({
    challenge: dailyChallengeDefinitionSchema,
    formalAttemptsRemaining: z.number().int().min(0).max(3),
    formalUnlocked: z.boolean(),
    activeAttemptId: uuidSchema.nullable(),
    activeAttempt: z
      .object({
        attemptId: uuidSchema,
        mode: dailyAttemptModeSchema,
        checkpoint: dailyAttemptCheckpointRequestSchema.nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const dailyAttemptStartResponseSchema = z
  .object({
    attemptId: uuidSchema,
    challenge: dailyChallengeDefinitionSchema,
    mode: dailyAttemptModeSchema,
    status: z.literal("active"),
    formalAttemptsRemaining: z.number().int().min(0).max(3),
    checkpoint: dailyAttemptCheckpointRequestSchema.nullable(),
  })
  .strict();

export const dailyAttemptCheckpointResponseSchema = z
  .object({
    attemptId: uuidSchema,
    checkpointIndex: nonNegativeInteger,
    acceptedAt: isoDateTime,
  })
  .strict();

export const dailyNodeReplaySchema = z
  .object({
    nodeId: identifier,
    initialStateHash: stateHash,
    commands: z.array(battleCommandSchema).max(100_000),
    checkpoints: z.array(replayCheckpointSchema).max(100_000),
    finalStateHash: stateHash,
  })
  .strict();

export const finishDailyAttemptRequestSchema = z
  .object({
    submissionId: uuidSchema,
    challengeId,
    seed: z.number().int().min(0).max(0xffff_ffff),
    rulesVersion: semanticVersion,
    contentVersion: semanticVersion,
    replaySchemaVersion: z.literal(DAILY_REPLAY_SCHEMA_VERSION),
    clientVersion: semanticVersion,
    claimedScore: nonNegativeInteger.max(1_000_000),
    completionMs: nonNegativeInteger.max(24 * 60 * 60 * 1_000),
    recoveryCount: nonNegativeInteger.max(100),
    completionStatus: z.enum(["completed", "failed"]),
    completedNodeIds: z.array(identifier).max(32),
    nodeReplays: z.array(dailyNodeReplaySchema).max(32),
  })
  .strict();

export const dailyAttemptSubmissionResponseSchema = z
  .object({
    attemptId: uuidSchema,
    submissionId: uuidSchema,
    status: z.enum(["queued", "verified", "rejected"]),
  })
  .strict();

export const abandonDailyAttemptResponseSchema = z
  .object({
    attemptId: uuidSchema,
    status: z.literal("abandoned"),
  })
  .strict();

export const replayVerificationJobSchema = z
  .object({
    submissionId: uuidSchema,
  })
  .strict();

export const replayVerificationResultSchema = z
  .object({
    submissionId: uuidSchema,
    status: z.enum(["verified", "rejected"]),
    score: nonNegativeInteger.max(1_000_000).nullable(),
    totalTurns: nonNegativeInteger.nullable(),
    rejectionCode: z
      .enum([
        "CHALLENGE_MISMATCH",
        "CLIENT_VERSION_UNSUPPORTED",
        "REPLAY_INVALID",
        "CHECKPOINT_MISMATCH",
        "FINAL_HASH_MISMATCH",
        "INCOMPLETE_ROUTE",
        "SCORE_MISMATCH",
      ])
      .nullable(),
  })
  .strict();

export const leaderboardEntrySchema = z
  .object({
    rank: z.number().int().positive(),
    systemCode: z
      .string()
      .min(3)
      .max(48)
      .regex(/^[\p{Script=Han}A-Z0-9-]+$/u),
    avatarId: identifier,
    score: nonNegativeInteger.max(1_000_000),
    completionMs: nonNegativeInteger,
    turns: nonNegativeInteger,
    completionStatus: z.enum(["completed", "failed"]),
  })
  .strict();

export const dailyLeaderboardPageSchema = z
  .object({
    challengeId: dailyChallengeDefinitionSchema.shape.challengeId,
    entries: z.array(leaderboardEntrySchema).max(100),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict();

export const dailyLeaderboardMeSchema = z
  .object({
    challengeId: dailyChallengeDefinitionSchema.shape.challengeId,
    entry: leaderboardEntrySchema.nullable(),
  })
  .strict();

export type DailyChallengeDefinition = z.infer<typeof dailyChallengeDefinitionSchema>;
export type DailyChallengeResponse = z.infer<typeof dailyChallengeResponseSchema>;
export type DailyAttemptMode = z.infer<typeof dailyAttemptModeSchema>;
export type DailyAttemptStatus = z.infer<typeof dailyAttemptStatusSchema>;
export type DailyAttemptStartResponse = z.infer<typeof dailyAttemptStartResponseSchema>;
export type DailyAttemptCheckpointRequest = z.infer<typeof dailyAttemptCheckpointRequestSchema>;
export type DailyAttemptCheckpointResponse = z.infer<typeof dailyAttemptCheckpointResponseSchema>;
export type DailyNodeReplay = z.infer<typeof dailyNodeReplaySchema>;
export type FinishDailyAttemptRequest = z.infer<typeof finishDailyAttemptRequestSchema>;
export type DailyAttemptSubmissionResponse = z.infer<typeof dailyAttemptSubmissionResponseSchema>;
export type ReplayVerificationJob = z.infer<typeof replayVerificationJobSchema>;
export type ReplayVerificationResult = z.infer<typeof replayVerificationResultSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type DailyLeaderboardPage = z.infer<typeof dailyLeaderboardPageSchema>;
export type DailyLeaderboardMe = z.infer<typeof dailyLeaderboardMeSchema>;
