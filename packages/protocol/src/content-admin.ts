import { isoDateTimeSchema, z } from "./zod-compat.js";

const id = z.string().min(1).max(160);
const version = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const instant = isoDateTimeSchema;
const hash = z.string().regex(/^[a-f0-9]{64}$/);

export const publishedContentManifestSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    contentVersion: version,
    rulesVersion: version,
    artifactHash: hash,
    commitSha: z.string().min(7).max(64),
    createdAt: instant,
    catalogHashes: z.record(z.string(), hash),
    counts: z.record(z.string(), z.number().int().nonnegative()),
    simulation: z
      .object({
        seedCount: z.number().int().positive(),
        passed: z.number().int().nonnegative(),
        failedSeeds: z.array(z.number().int().nonnegative()),
        minimumMinutes: z.number().int().positive().nullable(),
        maximumMinutes: z.number().int().positive().nullable(),
      })
      .strict(),
  })
  .strict();

export const adminRoleSchema = z.enum(["viewer", "content_reviewer", "operator", "owner"]);
export const adminSessionRequestSchema = z
  .object({
    adminCode: z.string().regex(/^[a-zA-Z0-9_.@-]{2,80}$/),
    bootstrapToken: z.string().min(32).max(512),
  })
  .strict();
export const adminSessionResponseSchema = z
  .object({ accessToken: z.string().min(1), expiresAt: instant, role: adminRoleSchema })
  .strict();

export const adminContentStateSchema = z.enum([
  "draft",
  "validated",
  "staged",
  "approved",
  "signed",
  "published",
  "rolled_back",
  "frozen",
]);
export const adminContentVersionSchema = z
  .object({
    id,
    contentVersion: version,
    artifactHash: hash,
    state: adminContentStateSchema,
    manifest: publishedContentManifestSchema,
    createdBy: id,
    approvedBy: id.nullable(),
    signature: hash.nullable(),
    createdAt: instant,
    updatedAt: instant,
  })
  .strict();

export const confirmedAdminActionSchema = z
  .object({ reason: z.string().min(10).max(500), confirmation: z.string().min(3).max(200) })
  .strict();
export const announcementRequestSchema = z
  .object({
    titleKey: z.string().regex(/^[a-z][a-z0-9_.]*$/),
    bodyKey: z.string().regex(/^[a-z][a-z0-9_.]*$/),
    startsAt: instant,
    endsAt: instant,
    reason: z.string().min(10).max(500),
    confirmation: z.literal("CREATE ANNOUNCEMENT"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startsAt >= value.endsAt)
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "endsAt must follow startsAt",
      });
  });
export const riskSwitchRequestSchema = z
  .object({
    enabled: z.boolean(),
    reason: z.string().min(10).max(500),
    confirmation: z.literal("UPDATE RISK SWITCH"),
  })
  .strict();

export const adminAuditEntrySchema = z
  .object({
    id,
    actorId: id,
    action: id,
    targetType: id,
    targetId: id,
    reason: z.string().min(1).max(500),
    previousHash: hash.nullable(),
    entryHash: hash,
    createdAt: instant,
  })
  .strict();

export type PublishedContentManifest = z.infer<typeof publishedContentManifestSchema>;
export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AdminSessionRequest = z.infer<typeof adminSessionRequestSchema>;
export type AdminSessionResponse = z.infer<typeof adminSessionResponseSchema>;
export type AdminContentState = z.infer<typeof adminContentStateSchema>;
export type AdminContentVersion = z.infer<typeof adminContentVersionSchema>;
export type ConfirmedAdminAction = z.infer<typeof confirmedAdminActionSchema>;
export type AnnouncementRequest = z.infer<typeof announcementRequestSchema>;
export type RiskSwitchRequest = z.infer<typeof riskSwitchRequestSchema>;
export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;
