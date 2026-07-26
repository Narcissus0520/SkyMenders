import { z } from "./zod-compat.js";

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

const battlePhaseSchema = z.enum([
  "player_planning",
  "player_action",
  "enemy_action",
  "environment_settlement",
  "battle_complete",
]);

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

export const battlePhaseChangedEventSchema = z
  .object({
    ...eventBase,
    kind: z.literal("battle_phase_changed"),
    commandId: identifierSchema,
    fromPhase: battlePhaseSchema,
    toPhase: battlePhaseSchema,
  })
  .strict();

export const battleEffectAppliedEventSchema = z
  .object({
    ...eventBase,
    kind: z.literal("battle_effect_applied"),
    commandId: identifierSchema,
    effectId: identifierSchema,
    effectKind: z.enum([
      "energy_changed",
      "actor_moved",
      "actor_repaired",
      "actor_damaged",
      "structural_damage_changed",
      "fault_changed",
      "actor_disabled",
      "objective_progressed",
      "objective_completed",
      "terrain_damaged",
      "terrain_repaired",
      "terrain_collapsed",
      "field_created",
      "field_expired",
      "support_created",
      "support_expired",
      "world_object_moved",
      "intel_revealed",
    ]),
    sourceId: identifierSchema,
    targetId: identifierSchema.optional(),
    targetX: safeIntegerSchema.optional(),
    targetY: safeIntegerSchema.optional(),
    magnitude: safeIntegerSchema,
    duration: z.number().int().min(0).max(10_000),
    detailHash: z.string().regex(/^[0-9a-f]{16}$/),
  })
  .strict()
  .superRefine((event, context) => {
    if ((event.targetX === undefined) !== (event.targetY === undefined)) {
      context.addIssue({
        code: "custom",
        message: "targetX and targetY must be provided together",
      });
    }
  });

export const battleEventSchema = z.union([
  commandAcceptedEventSchema,
  actorMovedEventSchema,
  moduleResolvedEventSchema,
  turnWaitedEventSchema,
  interactionCompletedEventSchema,
  stateCheckpointEventSchema,
  battlePhaseChangedEventSchema,
  battleEffectAppliedEventSchema,
]);

export type BattleEvent = z.infer<typeof battleEventSchema>;

export function parseBattleEvent(input: unknown): BattleEvent {
  return battleEventSchema.parse(input);
}
