import { hashCanonical } from "@skymenders/deterministic-runtime";
import type { CanonicalValue, DeterministicReducer } from "@skymenders/deterministic-runtime";
import type { BattleEvent } from "@skymenders/protocol";

interface Position extends Record<string, CanonicalValue> {
  readonly x: number;
  readonly y: number;
}

export interface RuntimeLedgerState extends Record<string, CanonicalValue> {
  readonly positions: Readonly<Record<string, Position>>;
  readonly waits: number;
  readonly modules: readonly string[];
  readonly interactions: readonly string[];
  readonly checksum: number;
}

export const runtimeLedgerReducer: DeterministicReducer<RuntimeLedgerState> = (
  state,
  command,
  commandIndex,
  context,
) => {
  const positions: Record<string, Position> = { ...state.positions };
  const modules = [...state.modules];
  const interactions = [...state.interactions];
  let waits = state.waits;
  let checksum = state.checksum + (commandIndex === 0 ? context.rootSeed : 0);
  const sequence = commandIndex * 3;
  const events: BattleEvent[] = [
    {
      kind: "command_accepted",
      battleId: command.battleId,
      commandId: command.commandId,
      actorId: command.actorId,
      turnIndex: command.turnIndex,
      sequence,
    },
  ];

  switch (command.kind) {
    case "move": {
      const previous = positions[command.actorId] ?? { x: 0, y: 0 };
      positions[command.actorId] = { x: command.destinationX, y: command.destinationY };
      checksum += command.destinationX + command.destinationY;
      events.push({
        kind: "actor_moved",
        battleId: command.battleId,
        commandId: command.commandId,
        actorId: command.actorId,
        turnIndex: command.turnIndex,
        sequence: sequence + 1,
        fromX: previous.x,
        fromY: previous.y,
        toX: command.destinationX,
        toY: command.destinationY,
      });
      break;
    }
    case "use_module": {
      modules.push(command.moduleId);
      checksum += command.angleMilliDegrees + command.powerPermille;
      events.push({
        kind: "module_resolved",
        battleId: command.battleId,
        commandId: command.commandId,
        actorId: command.actorId,
        turnIndex: command.turnIndex,
        sequence: sequence + 1,
        moduleId: command.moduleId,
        resolutionHash: hashCanonical({
          moduleId: command.moduleId,
          angleMilliDegrees: command.angleMilliDegrees,
          powerPermille: command.powerPermille,
        }),
      });
      break;
    }
    case "interact": {
      interactions.push(command.targetId);
      checksum += command.targetId.length;
      events.push({
        kind: "interaction_completed",
        battleId: command.battleId,
        commandId: command.commandId,
        actorId: command.actorId,
        turnIndex: command.turnIndex,
        sequence: sequence + 1,
        targetId: command.targetId,
      });
      break;
    }
    case "wait": {
      waits += 1;
      checksum += 1;
      events.push({
        kind: "turn_waited",
        battleId: command.battleId,
        commandId: command.commandId,
        actorId: command.actorId,
        turnIndex: command.turnIndex,
        sequence: sequence + 1,
      });
      break;
    }
  }

  const nextState = { positions, waits, modules, interactions, checksum };
  events.push({
    kind: "state_checkpoint",
    battleId: command.battleId,
    turnIndex: command.turnIndex,
    sequence: sequence + 2,
    commandIndex,
    stateHash: hashCanonical(nextState),
  });

  return { state: nextState, events };
};
