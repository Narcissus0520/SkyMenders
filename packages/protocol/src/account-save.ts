import { isoDateTimeSchema, jsonValueSchema, uuidSchema, z } from "./zod-compat.js";

export const SAVE_SCHEMA_VERSION = "0.1.0";

const semanticVersion = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const stableId = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(96);
const uint32 = z.number().int().min(0).max(0xffff_ffff);
const nonNegative = z.number().int().nonnegative();
const stateHash = z.string().regex(/^[0-9a-f]{16}$/);

export const deviceKindSchema = z.enum(["wechat", "web", "unknown"]);

export const profileSettingsSchema = z
  .object({
    textScalePermille: z.number().int().min(1_000).max(1_500),
    highContrast: z.boolean(),
    colorVisionPreset: z.enum(["standard", "deuteranopia", "protanopia", "tritanopia"]),
    reduceFlash: z.boolean(),
    reduceCameraMotion: z.boolean(),
    cameraShakePermille: z.number().int().min(0).max(1_000),
    leftHanded: z.boolean(),
    aimingSensitivityPermille: z.number().int().min(500).max(1_500),
    cameraSensitivityPermille: z.number().int().min(500).max(1_500),
    releaseToFire: z.boolean(),
    masterVolumePermille: z.number().int().min(0).max(1_000),
    musicVolumePermille: z.number().int().min(0).max(1_000),
    ambientVolumePermille: z.number().int().min(0).max(1_000),
    combatVolumePermille: z.number().int().min(0).max(1_000),
    uiVolumePermille: z.number().int().min(0).max(1_000),
    vibration: z.boolean(),
  })
  .strict();

export const profileSettingsPatchSchema = profileSettingsSchema.partial().strict();

export const accountProgressSaveSchema = z
  .object({
    saveSchemaVersion: z.literal(SAVE_SCHEMA_VERSION),
    logicalClock: nonNegative,
    updatedAt: isoDateTimeSchema,
    unlockIds: z.array(stableId).max(512),
    achievementIds: z.array(stableId).max(512),
    compendiumEntryIds: z.array(stableId).max(1_024),
    completedTutorialIds: z.array(stableId).max(32),
    settings: profileSettingsSchema,
    statistics: z.record(stableId, nonNegative).refine((value) => Object.keys(value).length <= 256),
  })
  .strict();

const expeditionNodeTypeSchema = z.enum([
  "battle",
  "engineering",
  "elite",
  "event",
  "workshop",
  "supply",
  "boss",
]);

const expeditionNodeSchema = z
  .object({
    id: stableId,
    regionIndex: z.number().int().min(1).max(4),
    layer: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    type: expeditionNodeTypeSchema,
    mapId: stableId.nullable(),
    eventId: stableId.nullable(),
    bossId: stableId.nullable(),
    risk: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    nextNodeIds: z.array(stableId).max(6),
  })
  .strict();

const expeditionRegionSchema = z
  .object({
    id: stableId,
    regionIndex: z.number().int().min(1).max(4),
    layers: z.tuple([
      z.array(expeditionNodeSchema).min(2).max(3),
      z.array(expeditionNodeSchema).min(2).max(3),
      z.tuple([expeditionNodeSchema]),
    ]),
  })
  .strict();

export const expeditionStateSchema = z
  .object({
    plan: z
      .object({
        schemaVersion: z.literal("0.1.0"),
        contentVersion: semanticVersion,
        rulesVersion: semanticVersion,
        seed: uint32,
        regions: z.array(expeditionRegionSchema).length(4),
      })
      .strict(),
    status: z.enum(["active", "victory", "defeat"]),
    regionIndex: z.number().int().min(1).max(4),
    layer: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    completedNodeIds: z.array(stableId).max(12),
    robots: z
      .array(
        z
          .object({
            robotId: stableId,
            hp: nonNegative.max(100_000),
            maxHp: z.number().int().positive().max(100_000),
            structuralDamage: z.number().int().min(0).max(100),
            disabled: z.boolean(),
          })
          .strict(),
      )
      .length(3),
    researchEarned: nonNegative,
    supplies: nonNegative,
    routeRevealDepth: z.number().int().min(1).max(3),
    inventory: z
      .object({
        moduleIds: z.array(stableId).max(18),
        upgradeRouteIds: z.array(stableId).max(18),
        temporaryModIds: z.array(stableId).max(64),
        consumables: nonNegative.max(999),
      })
      .strict(),
    restartUsedNodeIds: z.array(stableId).max(12),
  })
  .strict();

const rngStateSchema = z
  .tuple([uint32, uint32, uint32, uint32])
  .refine((values) => values.some((value) => value !== 0), "RNG state cannot be all zero");

export const runtimeSnapshotSchema = z
  .object({
    snapshotSchemaVersion: z.literal("0.1.0"),
    rulesVersion: semanticVersion,
    contentVersion: semanticVersion,
    replaySchemaVersion: semanticVersion,
    turnIndex: nonNegative,
    commandIndex: nonNegative,
    rngStates: z
      .object({
        map: rngStateSchema.optional(),
        enemy: rngStateSchema.optional(),
        ai: rngStateSchema.optional(),
        aim_error: rngStateSchema.optional(),
        reward: rngStateSchema.optional(),
        fault: rngStateSchema.optional(),
        event: rngStateSchema.optional(),
        hidden_objective: rngStateSchema.optional(),
      })
      .strict(),
    state: jsonValueSchema,
    stateHash,
  })
  .strict();

export const expeditionSaveDocumentSchema = z
  .object({
    saveSchemaVersion: z.literal(SAVE_SCHEMA_VERSION),
    saveId: uuidSchema,
    revision: nonNegative,
    logicalClock: nonNegative,
    deviceKind: deviceKindSchema,
    updatedAt: isoDateTimeSchema,
    contentVersion: semanticVersion,
    rulesVersion: semanticVersion,
    expedition: expeditionStateSchema,
    nodeStartSnapshot: runtimeSnapshotSchema.nullable(),
    battleTurnSnapshot: runtimeSnapshotSchema.nullable(),
    summary: z
      .object({
        regionIndex: z.number().int().min(1).max(4),
        layer: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        completedNodes: z.number().int().min(0).max(12),
        squadRobotIds: z.array(stableId).length(3),
      })
      .strict(),
    integrityHash: stateHash,
  })
  .strict();

export const wechatLoginRequestSchema = z
  .object({ code: z.string().min(1).max(128), deviceKind: deviceKindSchema })
  .strict();
export const refreshSessionRequestSchema = z
  .object({ refreshToken: z.string().min(43).max(256) })
  .strict();
export const logoutRequestSchema = refreshSessionRequestSchema;

export const sessionResponseSchema = z
  .object({
    accessToken: z.string().min(32).max(4_096),
    accessExpiresAt: isoDateTimeSchema,
    refreshToken: z.string().min(43).max(256),
    refreshExpiresAt: isoDateTimeSchema,
    accountId: uuidSchema,
  })
  .strict();

export const putExpeditionSaveRequestSchema = z
  .object({ baseRevision: nonNegative.nullable(), document: expeditionSaveDocumentSchema })
  .strict();

export const resolveSaveConflictRequestSchema = z
  .object({
    choice: z.enum(["local", "cloud"]),
    expectedCloudRevision: nonNegative,
    localDocument: expeditionSaveDocumentSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.choice === "local" && value.localDocument === null)
      context.addIssue({ code: "custom", message: "local choice requires a local document" });
  });

export const privacyDeleteRequestSchema = z
  .object({ confirmation: z.literal("DELETE_ACCOUNT") })
  .strict();

export const privacyRequestResponseSchema = z
  .object({
    requestId: uuidSchema,
    kind: z.enum(["export", "delete"]),
    status: z.enum(["pending", "processing", "completed", "failed"]),
    createdAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export type AccountProgressSave = z.infer<typeof accountProgressSaveSchema>;
export type DeviceKind = z.infer<typeof deviceKindSchema>;
export type ExpeditionSaveDocument = z.infer<typeof expeditionSaveDocumentSchema>;
export type ExpeditionStateDocument = z.infer<typeof expeditionStateSchema>;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
export type PrivacyDeleteRequest = z.infer<typeof privacyDeleteRequestSchema>;
export type PrivacyRequestResponse = z.infer<typeof privacyRequestResponseSchema>;
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
export type ProfileSettingsPatch = z.infer<typeof profileSettingsPatchSchema>;
export type PutExpeditionSaveRequest = z.infer<typeof putExpeditionSaveRequestSchema>;
export type RefreshSessionRequest = z.infer<typeof refreshSessionRequestSchema>;
export type ResolveSaveConflictRequest = z.infer<typeof resolveSaveConflictRequestSchema>;
export type RuntimeSnapshotDocument = z.infer<typeof runtimeSnapshotSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type WechatLoginRequest = z.infer<typeof wechatLoginRequestSchema>;
