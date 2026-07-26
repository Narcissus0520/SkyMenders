import { battleCommandSchema } from "./battle-command.js";
import { jsonValueSchema, z } from "./zod-compat.js";

const semanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const stateHashSchema = z.string().regex(/^[0-9a-f]{16}$/);

export const replayCheckpointSchema = z
  .object({
    commandIndex: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    stateHash: stateHashSchema,
  })
  .strict();

export const replayFileSchema = z
  .object({
    replaySchemaVersion: semanticVersionSchema,
    rulesVersion: semanticVersionSchema,
    contentVersion: semanticVersionSchema,
    fixtureId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/),
    rootSeed: z.number().int().min(0).max(0xffff_ffff),
    initialState: jsonValueSchema,
    commands: z.array(battleCommandSchema).max(100_000),
    expectedCheckpoints: z.array(replayCheckpointSchema).max(100_000),
    expectedFinalHash: stateHashSchema,
  })
  .strict();

export type ReplayCheckpoint = z.infer<typeof replayCheckpointSchema>;
export type ReplayFile = z.infer<typeof replayFileSchema>;

export function parseReplayFile(input: unknown): ReplayFile {
  return replayFileSchema.parse(input);
}
