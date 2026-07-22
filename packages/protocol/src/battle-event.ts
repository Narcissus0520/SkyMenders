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
const eventBase = {
  battleId: identifierSchema,
  sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  turnIndex: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
} as const;

export const commandAcceptedEventSchema = z
  .object({
    ...eventBase,
    kind: z.literal("command_accepted"),
    commandId: identifierSchema,
    actorId: identifierSchema,
  })
  .strict();

export const actorMovedEventSchema = z
  .object({
    ...eventBase,
    kind: z.literal("actor_moved"),
    commandId: identifierSchema,
    actorId: identifierSchema,
    fromX: safeIntegerSchema,
    fromY: safeIntegerSchema,
    toX: safeIntegerSchema,
    toY: safeIntegerSchema,
  })
  .strict();

export const moduleResolvedEventSchema = z
  .object({
    ...eventBase,
    kind: z.literal("module_resolved"),
    commandId: identifierSchema,
    actorId: identifierSchema,
    moduleId: identifierSchema,
    resolutionHash: z.string().regex(/^[0-9a-f]{16}$/),
  })
  .strict();

export const turnWaitedEventSchema = z
  .object({
    ...eventBase,
    kind: z.literal("turn_waited"),
    commandId: identifierSchema,
    actorId: identifierSchema,
  })
  .strict();

export const interactionCompletedEventSchema = z
  .object({
    ...eventBase,
    kind: z.literal("interaction_completed"),
    commandId: identifierSchema,
    actorId: identifierSchema,
    targetId: identifierSchema,
  })
  .strict();

export const stateCheckpointEventSchema = z
  .object({
    ...eventBase,
    kind: z.literal("state_checkpoint"),
    commandIndex: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    stateHash: z.string().regex(/^[0-9a-f]{16}$/),
  })
  .strict();

export const battleEventSchema = z.discriminatedUnion("kind", [
  commandAcceptedEventSchema,
  actorMovedEventSchema,
  moduleResolvedEventSchema,
  turnWaitedEventSchema,
  interactionCompletedEventSchema,
  stateCheckpointEventSchema,
]);

export type BattleEvent = z.infer<typeof battleEventSchema>;

export function parseBattleEvent(input: unknown): BattleEvent {
  return battleEventSchema.parse(input);
}
