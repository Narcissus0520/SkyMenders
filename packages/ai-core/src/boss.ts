import type { ModuleId } from "@skymenders/battle-core";
import { parseBattleEvent } from "@skymenders/protocol";
import type { BattleCommand } from "@skymenders/protocol";

import { getBossDefinition } from "./catalog.js";
import { assertAiAuthorityState, findBossRuntime, replaceBossRuntime } from "./state.js";
import { AI_MAX_BOSS_COUNTERS } from "./types.js";
import type {
  AiAuthorityState,
  BossCounterResult,
  BossCounterSignal,
  BossId,
  BossRuntimeState,
} from "./types.js";

const MODULE_COUNTER_SIGNALS: Readonly<Partial<Record<ModuleId, BossCounterSignal>>> =
  Object.freeze({
    main_drill_bee: "terrain_breached",
    main_fold_bridge: "support_restored",
    main_support_frame: "support_restored",
    aux_terrain_foam: "support_restored",
    main_energy_rail: "energy_routed",
    aux_energy_recycler: "energy_routed",
    main_magnetic_anchor: "magnetic_redirected",
    main_gravity_pin: "gravity_redirected",
    aux_repair_spray: "core_repaired",
    aux_jammer: "control_disrupted",
    aux_reflector: "control_disrupted",
    main_wind_generator: "control_disrupted",
    main_bubble_capsule: "rescue_secured",
    aux_ejector: "rescue_secured",
    aux_grapple: "rescue_secured",
    aux_stabilizer: "rescue_secured",
  });

export function bossCounterSignalForCommand(command: BattleCommand): BossCounterSignal | null {
  if (command.kind !== "use_module") return null;
  return MODULE_COUNTER_SIGNALS[command.moduleId as ModuleId] ?? null;
}

export function applyBossCounterCommand(
  state: AiAuthorityState,
  bossId: BossId,
  command: BattleCommand,
  inputEvents: readonly unknown[],
): BossCounterResult {
  assertAiAuthorityState(state);
  const events = inputEvents.map((event) => parseBattleEvent(event));
  const signal = bossCounterSignalForCommand(command);
  if (signal === null) throw new Error("command does not produce a boss counter signal");
  const acceptedEvents = events.filter(
    (event) => event.kind === "command_accepted" && event.commandId === command.commandId,
  );
  const checkpoints = events.filter((event) => event.kind === "state_checkpoint");
  const meaningfulEffect = events.some(
    (event) =>
      event.kind === "battle_effect_applied" &&
      event.commandId === command.commandId &&
      event.effectKind !== "energy_changed",
  );
  const envelopeMatches = events.every(
    (event) => event.battleId === command.battleId && event.turnIndex === command.turnIndex,
  );
  const acceptedSequence = acceptedEvents[0]?.sequence ?? Number.MAX_SAFE_INTEGER;
  const checkpointSequence = checkpoints[0]?.sequence ?? -1;
  if (
    acceptedEvents.length !== 1 ||
    checkpoints.length !== 1 ||
    checkpointSequence <= acceptedSequence ||
    !meaningfulEffect ||
    !envelopeMatches
  ) {
    throw new Error("boss counters require an accepted, checkpointed command with a rule effect");
  }
  return applyBossCounterSignal(state, bossId, command.commandId, signal);
}

export function applyBossCounterSignal(
  state: AiAuthorityState,
  bossId: BossId,
  commandId: string,
  signal: BossCounterSignal,
): BossCounterResult {
  assertAiAuthorityState(state);
  const runtime = findBossRuntime(state, bossId);
  const definition = getBossDefinition(bossId);
  const stage = definition.stages[runtime.stageIndex];
  if (stage === undefined) throw new Error(`boss stage is missing: ${bossId}`);
  if (runtime.acceptedCommandIds.includes(commandId)) {
    throw new Error(`boss counter command was already applied: ${commandId}`);
  }
  if (runtime.completed || !stage.counters.includes(signal)) {
    return {
      state,
      event: {
        kind: "counter_ignored",
        bossId,
        commandId,
        signal,
        fromStageId: stage.id,
        toStageId: null,
        progress: runtime.stageProgress,
      },
    };
  }
  if (runtime.acceptedCommandIds.length >= AI_MAX_BOSS_COUNTERS) {
    throw new RangeError("boss counter command log is full");
  }
  const progress = runtime.stageProgress + 1;
  let nextRuntime: BossRuntimeState;
  let kind: BossCounterResult["event"]["kind"] = "counter_applied";
  let toStageId: string | null = null;
  if (progress < stage.requiredProgress) {
    nextRuntime = {
      ...runtime,
      stageProgress: progress,
      acceptedCommandIds: [...runtime.acceptedCommandIds, commandId],
    };
  } else if (runtime.stageIndex === definition.stages.length - 1) {
    kind = "boss_completed";
    toStageId = "complete";
    nextRuntime = {
      ...runtime,
      stageProgress: 0,
      completed: true,
      acceptedCommandIds: [...runtime.acceptedCommandIds, commandId],
      stageHistory: [...runtime.stageHistory, "complete"],
    };
  } else {
    kind = "stage_changed";
    const nextStage = definition.stages[runtime.stageIndex + 1];
    if (nextStage === undefined) throw new Error("boss next stage is missing");
    toStageId = nextStage.id;
    nextRuntime = {
      ...runtime,
      stageIndex: runtime.stageIndex + 1,
      stageProgress: 0,
      acceptedCommandIds: [...runtime.acceptedCommandIds, commandId],
      stageHistory: [...runtime.stageHistory, nextStage.id],
    };
  }
  const nextState = replaceBossRuntime(state, nextRuntime);
  assertAiAuthorityState(nextState);
  return {
    state: nextState,
    event: {
      kind,
      bossId,
      commandId,
      signal,
      fromStageId: stage.id,
      toStageId,
      progress: nextRuntime.stageProgress,
    },
  };
}
