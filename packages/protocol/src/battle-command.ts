import { z } from "zod";

const identifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const safeIntegerSchema = z
  .number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
const nonNegativeIntegerSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const commandBase = {
  commandId: identifierSchema,
  battleId: identifierSchema,
  turnIndex: nonNegativeIntegerSchema,
  actorId: identifierSchema,
} as const;

export const moveCommandSchema = z
  .object({
    ...commandBase,
    kind: z.literal("move"),
    destinationX: safeIntegerSchema,
    destinationY: safeIntegerSchema,
  })
  .strict();

export const useModuleCommandSchema = z
  .object({
    ...commandBase,
    kind: z.literal("use_module"),
    moduleId: identifierSchema,
    originX: safeIntegerSchema,
    originY: safeIntegerSchema,
    angleMilliDegrees: z.number().int().min(0).max(359_999),
    powerPermille: z.number().int().min(0).max(1_000),
    targetX: safeIntegerSchema.optional(),
    targetY: safeIntegerSchema.optional(),
  })
  .strict();

export const waitCommandSchema = z
  .object({
    ...commandBase,
    kind: z.literal("wait"),
  })
  .strict();

export const interactCommandSchema = z
  .object({
    ...commandBase,
    kind: z.literal("interact"),
    targetId: identifierSchema,
  })
  .strict();

export const battleCommandSchema = z.discriminatedUnion("kind", [
  moveCommandSchema,
  useModuleCommandSchema,
  waitCommandSchema,
  interactCommandSchema,
]);

export type BattleCommand = z.infer<typeof battleCommandSchema>;
export type MoveCommand = z.infer<typeof moveCommandSchema>;
export type UseModuleCommand = z.infer<typeof useModuleCommandSchema>;
export type WaitCommand = z.infer<typeof waitCommandSchema>;
export type InteractCommand = z.infer<typeof interactCommandSchema>;

export function parseBattleCommand(input: unknown): BattleCommand {
  return battleCommandSchema.parse(input);
}
