import { hashCanonical } from "@skymenders/deterministic-runtime";
import { parseBattleCommand, parseBattleEvent } from "@skymenders/protocol";
import type {
  BattleCommand,
  BattleEvent,
  InteractCommand,
  MoveCommand,
  UseBasicActionCommand,
  WaitCommand,
} from "@skymenders/protocol";
import { analyzeTerrainSupport, getTerrainCell, terrainIndex } from "@skymenders/terrain-core";

import { repairBattleActor } from "./durability.js";
import { resolveModuleCommand } from "./modules.js";
import { applyObjectiveSignal } from "./objectives.js";
import { advanceBattlePhase } from "./phases.js";
import {
  assertBattleState,
  actorTeamEnergy,
  effectiveMoveDistance,
  findBattleActor,
  manhattanDistance,
  replaceBattleActor,
  replaceActorTeamEnergy,
} from "./state.js";
import { BATTLE_MAX_COMMANDS } from "./types.js";
import type {
  BattleActor,
  BattleCommandExecution,
  BattleRuleEffect,
  BattleState,
  BattleTransition,
} from "./types.js";

export interface BattleReducerResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

export function reduceBattleCommand(
  inputState: BattleState,
  inputCommand: unknown,
  commandIndex: number,
): BattleReducerResult {
  assertBattleState(inputState);
  if (
    !Number.isSafeInteger(commandIndex) ||
    commandIndex < 0 ||
    commandIndex >= BATTLE_MAX_COMMANDS
  ) {
    throw new RangeError("battle command index is outside the supported range");
  }
  const command = parseBattleCommand(inputCommand);
  assertCommandEnvelope(inputState, command);
  const fromPhase = inputState.phase;
  const actorBefore =
    command.kind === "advance_phase" ? null : findBattleActor(inputState, command.actorId);
  const transition = dispatchCommand(inputState, command);
  const specificEvents = commandSpecificEvents(
    inputState,
    transition.state,
    command,
    transition.effects,
    actorBefore,
  );
  const effectEvents = transition.effects.map((effect, index) =>
    effectEvent(
      inputState,
      command,
      effect,
      inputState.nextEventSequence + 1 + specificEvents.length + index,
      index,
    ),
  );
  const events: BattleEvent[] = [
    {
      kind: "command_accepted",
      battleId: command.battleId,
      commandId: command.commandId,
      actorId: command.actorId,
      turnIndex: command.turnIndex,
      sequence: inputState.nextEventSequence,
    },
    ...specificEvents,
    ...effectEvents,
  ];
  const stateWithSequence: BattleState = {
    ...transition.state,
    nextEventSequence: inputState.nextEventSequence + events.length + 1,
  };
  events.push({
    kind: "state_checkpoint",
    battleId: command.battleId,
    turnIndex: command.turnIndex,
    sequence: stateWithSequence.nextEventSequence - 1,
    commandIndex,
    stateHash: hashCanonical(stateWithSequence),
  });
  for (const event of events) parseBattleEvent(event);
  assertBattleState(stateWithSequence);
  if (command.kind === "advance_phase" && fromPhase === stateWithSequence.phase) {
    throw new Error("phase command did not advance battle phase");
  }
  return { state: stateWithSequence, events };
}

export function executeBattleCommands(
  initialState: BattleState,
  commands: readonly unknown[],
): BattleCommandExecution {
  assertBattleState(initialState);
  if (commands.length > BATTLE_MAX_COMMANDS) {
    throw new RangeError(`battle command log cannot exceed ${BATTLE_MAX_COMMANDS} entries`);
  }
  let state = initialState;
  const events: BattleEvent[] = [];
  const checkpoints: BattleCommandExecution["checkpoints"][number][] = [];
  commands.forEach((command, commandIndex) => {
    const result = reduceBattleCommand(state, command, commandIndex);
    state = result.state;
    events.push(...result.events);
    checkpoints.push({ commandIndex, stateHash: hashCanonical(state) });
  });
  return { finalState: state, checkpoints, events };
}

function dispatchCommand(state: BattleState, command: BattleCommand): BattleTransition {
  if (command.kind === "advance_phase") {
    if (command.expectedPhase !== state.phase) {
      throw new Error(
        `phase precondition mismatch: expected ${command.expectedPhase}, state is ${state.phase}`,
      );
    }
    return advanceBattlePhase(state);
  }
  const actor = findBattleActor(state, command.actorId);
  assertActorTurn(state, actor);
  switch (command.kind) {
    case "move":
      return moveActor(state, actor, command);
    case "use_module":
      return resolveModuleCommand(state, command, state.config);
    case "wait":
      return waitActor(state, actor, command);
    case "interact":
      return interactWithObjective(state, actor, command);
    case "use_basic_action":
      return useBasicAction(state, actor, command);
  }
}

function moveActor(state: BattleState, actor: BattleActor, command: MoveCommand): BattleTransition {
  if (actor.actionEnded || actor.movementUsed)
    throw new Error("actor cannot move again this round");
  const destination = { x: command.destinationX, y: command.destinationY };
  const distance = manhattanDistance(actor, destination);
  if (distance <= 0 || distance > effectiveMoveDistance(actor, state.config)) {
    throw new Error("movement distance is outside the actor allowance");
  }
  assertStandableDestination(state, destination.x, destination.y, actor.id);
  return {
    state: replaceBattleActor(state, { ...actor, ...destination, movementUsed: true }),
    effects: [],
  };
}

function waitActor(
  state: BattleState,
  actor: BattleActor,
  _command: WaitCommand,
): BattleTransition {
  if (actor.actionEnded) throw new Error("actor action has already ended");
  const teamEnergy = actorTeamEnergy(state, actor.team);
  const remainingWaitGrant = Math.max(
    0,
    teamEnergy.maximumWaitEnergyPerRound - teamEnergy.waitEnergyGrantedThisRound,
  );
  const gain = Math.min(
    teamEnergy.waitGain,
    remainingWaitGrant,
    teamEnergy.maximum - teamEnergy.current,
  );
  const withActor = replaceBattleActor(state, { ...actor, actionEnded: true });
  return {
    state: replaceActorTeamEnergy(withActor, actor.team, {
      ...teamEnergy,
      current: teamEnergy.current + gain,
      waitEnergyGrantedThisRound: teamEnergy.waitEnergyGrantedThisRound + gain,
    }),
    effects:
      gain === 0
        ? []
        : [
            ruleEffect("energy_changed", actor.id, null, null, null, gain, 0, {
              reason: "wait",
              team: actor.team,
            }),
          ],
  };
}

function interactWithObjective(
  state: BattleState,
  actor: BattleActor,
  command: InteractCommand,
): BattleTransition {
  if (actor.actionEnded) throw new Error("actor action has already ended");
  const objective = state.objectives.find(
    (candidate) =>
      candidate.status === "active" &&
      (candidate.id === command.targetId || candidate.targetId === command.targetId),
  );
  if (objective === undefined)
    throw new Error(`active objective target not found: ${command.targetId}`);
  if (!objective.criticalInteraction || objective.requiredModuleId !== null) {
    throw new Error("objective requires its declared module rather than a critical interaction");
  }
  const progressed = applyObjectiveSignal(state, {
    trigger: objective.trigger,
    sourceId: actor.id,
    targetId: objective.targetId,
    amount: 1,
  });
  return {
    state: replaceBattleActor(progressed.state, { ...actor, actionEnded: true }),
    effects: progressed.effects,
  };
}

function useBasicAction(
  state: BattleState,
  actor: BattleActor,
  command: UseBasicActionCommand,
): BattleTransition {
  if (actor.actionEnded) throw new Error("actor action has already ended");
  if (command.action === "repair") {
    const target = findBattleActor(state, command.targetId);
    if (target.team !== actor.team || manhattanDistance(actor, target) > 1) {
      throw new Error("basic repair target must be self or an adjacent ally");
    }
    const repaired = repairBattleActor(state, target.id, state.config.basicRepairHp, actor.id);
    const actingActor = findBattleActor(repaired.state, actor.id);
    return {
      state: replaceBattleActor(repaired.state, { ...actingActor, actionEnded: true }),
      effects: repaired.effects,
    };
  }
  const targetActor = state.actors.find(
    (candidate) => candidate.id === command.targetId && !candidate.disabled,
  );
  const targetObject = state.worldObjects.find(
    (candidate) => candidate.id === command.targetId && candidate.active,
  );
  const target = targetActor ?? targetObject;
  if (target === undefined || target.id === actor.id || manhattanDistance(actor, target) > 1) {
    throw new Error("basic push target must be an adjacent actor or world object");
  }
  const directionX = Math.sign(target.x - actor.x);
  const directionY = directionX === 0 ? Math.sign(target.y - actor.y) : 0;
  const destination = {
    x: command.targetX ?? target.x + directionX * state.config.basicPushDistance,
    y: command.targetY ?? target.y + directionY * state.config.basicPushDistance,
  };
  if (manhattanDistance(target, destination) > state.config.basicPushDistance) {
    throw new Error("basic push destination exceeds fallback range");
  }
  assertOpenDestination(state, destination.x, destination.y, target.id);
  let next = state;
  if (targetActor !== undefined) {
    next = replaceBattleActor(next, { ...targetActor, ...destination });
  } else if (targetObject !== undefined) {
    next = {
      ...next,
      worldObjects: next.worldObjects.map((candidate) =>
        candidate.id === targetObject.id ? { ...candidate, ...destination } : candidate,
      ),
    };
  }
  next = replaceBattleActor(next, { ...actor, actionEnded: true });
  return {
    state: next,
    effects: [
      ruleEffect("world_object_moved", actor.id, target.id, destination.x, destination.y, 1, 0, {
        reason: "basic_push",
      }),
    ],
  };
}

function assertCommandEnvelope(state: BattleState, command: BattleCommand): void {
  if (command.battleId !== state.battleId)
    throw new Error("command battle id does not match state");
  if (command.turnIndex !== state.turnIndex)
    throw new Error("command turn index does not match state");
  if (state.phase === "battle_complete")
    throw new Error("completed battle rejects further commands");
  if (command.kind === "advance_phase" && command.actorId !== "system") {
    throw new Error("only the authority system may advance battle phase");
  }
}

function assertActorTurn(state: BattleState, actor: BattleActor): void {
  if (actor.disabled) throw new Error("disabled actor cannot act");
  if (state.phase === "player_action" && actor.team === "player") return;
  if (state.phase === "enemy_action" && actor.team === "enemy") return;
  throw new Error(`actor ${actor.id} cannot act during ${state.phase}`);
}

function assertStandableDestination(
  state: BattleState,
  x: number,
  y: number,
  ignoredId: string,
): void {
  assertOpenDestination(state, x, y, ignoredId);
  if (y <= 0 || getTerrainCell(state.terrain, x, y - 1) === null) {
    throw new Error("movement destination is not standable");
  }
  const support = analyzeTerrainSupport(state.terrain, { scope: "full" });
  if (!support.supportedCellIndices.includes(terrainIndex(state.terrain.width, x, y - 1))) {
    throw new Error("movement destination support is unstable");
  }
}

function assertOpenDestination(state: BattleState, x: number, y: number, ignoredId: string): void {
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= state.terrain.width ||
    y >= state.terrain.height
  ) {
    throw new Error("destination is outside battle terrain");
  }
  if (getTerrainCell(state.terrain, x, y) !== null) throw new Error("destination contains terrain");
  if (
    state.actors.some(
      (candidate) =>
        candidate.id !== ignoredId && !candidate.disabled && candidate.x === x && candidate.y === y,
    )
  ) {
    throw new Error("destination contains another actor");
  }
  if (
    state.worldObjects.some(
      (candidate) =>
        candidate.id !== ignoredId && candidate.active && candidate.x === x && candidate.y === y,
    )
  ) {
    throw new Error("destination contains a world object");
  }
}

function commandSpecificEvents(
  before: BattleState,
  after: BattleState,
  command: BattleCommand,
  effects: readonly BattleRuleEffect[],
  actorBefore: BattleActor | null,
): BattleEvent[] {
  const sequence = before.nextEventSequence + 1;
  switch (command.kind) {
    case "move": {
      if (actorBefore === null) throw new Error("move actor state is missing");
      const actorAfter = findBattleActor(after, command.actorId);
      return [
        {
          kind: "actor_moved",
          battleId: command.battleId,
          commandId: command.commandId,
          actorId: command.actorId,
          turnIndex: command.turnIndex,
          sequence,
          fromX: actorBefore.x,
          fromY: actorBefore.y,
          toX: actorAfter.x,
          toY: actorAfter.y,
        },
      ];
    }
    case "use_module":
      return [
        {
          kind: "module_resolved",
          battleId: command.battleId,
          commandId: command.commandId,
          actorId: command.actorId,
          turnIndex: command.turnIndex,
          sequence,
          moduleId: command.moduleId,
          resolutionHash: hashCanonical(effects),
        },
      ];
    case "wait":
      return [
        {
          kind: "turn_waited",
          battleId: command.battleId,
          commandId: command.commandId,
          actorId: command.actorId,
          turnIndex: command.turnIndex,
          sequence,
        },
      ];
    case "interact":
      return [
        {
          kind: "interaction_completed",
          battleId: command.battleId,
          commandId: command.commandId,
          actorId: command.actorId,
          turnIndex: command.turnIndex,
          sequence,
          targetId: command.targetId,
        },
      ];
    case "advance_phase":
      return [
        {
          kind: "battle_phase_changed",
          battleId: command.battleId,
          commandId: command.commandId,
          turnIndex: command.turnIndex,
          sequence,
          fromPhase: before.phase,
          toPhase: after.phase,
        },
      ];
    case "use_basic_action":
      return [];
  }
}

function effectEvent(
  state: BattleState,
  command: BattleCommand,
  effect: BattleRuleEffect,
  sequence: number,
  index: number,
): BattleEvent {
  return {
    kind: "battle_effect_applied",
    battleId: state.battleId,
    commandId: command.commandId,
    turnIndex: command.turnIndex,
    sequence,
    effectId: `rule:${command.commandId}:${index}`,
    effectKind: effect.kind,
    sourceId: effect.sourceId,
    ...(effect.targetId === null ? {} : { targetId: effect.targetId }),
    ...(effect.targetX === null || effect.targetY === null
      ? {}
      : { targetX: effect.targetX, targetY: effect.targetY }),
    magnitude: effect.magnitude,
    duration: effect.duration,
    detailHash: hashCanonical(effect.details),
  };
}

function ruleEffect(
  kind: BattleRuleEffect["kind"],
  sourceId: string,
  targetId: string | null,
  targetX: number | null,
  targetY: number | null,
  magnitude: number,
  duration: number,
  details: BattleRuleEffect["details"],
): BattleRuleEffect {
  return { kind, sourceId, targetId, targetX, targetY, magnitude, duration, details };
}
