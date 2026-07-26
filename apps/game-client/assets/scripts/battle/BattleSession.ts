import { executeAiEnemyPhase } from "@skymenders/ai-core";
import type { AiAuthorityState } from "@skymenders/ai-core";
import { reduceBattleCommand } from "@skymenders/battle-core";
import type { BattleState } from "@skymenders/battle-core";
import { parseBattleCommand } from "@skymenders/protocol/battle-command";
import type { BattleCommand } from "@skymenders/protocol/battle-command";
import type { BattleEvent } from "@skymenders/protocol/battle-event";
import { BattlePresentationStore } from "./presentation/BattlePresentationStore";

export class BattleSession {
  private battleValue: BattleState;
  private aiValue: AiAuthorityState;
  private commandIndex = 0;
  private readonly commandLog: BattleCommand[] = [];
  private readonly eventListeners = new Set<(events: readonly BattleEvent[]) => void>();

  constructor(
    battle: BattleState,
    ai: AiAuthorityState,
    readonly presentation = new BattlePresentationStore(),
  ) {
    this.battleValue = battle;
    this.aiValue = ai;
  }

  battleState(): BattleState {
    return this.battleValue;
  }
  aiState(): AiAuthorityState {
    return this.aiValue;
  }
  commands(): readonly BattleCommand[] {
    return [...this.commandLog];
  }

  dispatchPlayer(input: unknown): readonly BattleEvent[] {
    const command = parseBattleCommand(input);
    if (command.actorId === "system") throw new Error("player gateway rejects system commands");
    return this.reduce(command);
  }

  advancePhase(): readonly BattleEvent[] {
    return this.reduce({
      kind: "advance_phase",
      commandId: `system:${this.battleValue.turnIndex}:${this.commandIndex}`,
      battleId: this.battleValue.battleId,
      turnIndex: this.battleValue.turnIndex,
      actorId: "system",
      expectedPhase: this.battleValue.phase,
    });
  }

  executeEnemyPhase(): readonly BattleEvent[] {
    const result = executeAiEnemyPhase(this.battleValue, this.aiValue, this.commandIndex);
    this.battleValue = result.battleState;
    this.aiValue = result.aiState;
    this.commandIndex += result.commands.length;
    this.commandLog.push(...result.commands);
    this.publish(result.events);
    return result.events;
  }

  subscribe(listener: (events: readonly BattleEvent[]) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private reduce(command: BattleCommand): readonly BattleEvent[] {
    const result = reduceBattleCommand(this.battleValue, command, this.commandIndex);
    this.battleValue = result.state;
    this.commandIndex += 1;
    this.commandLog.push(command);
    this.publish(result.events);
    return result.events;
  }

  private publish(events: readonly BattleEvent[]): void {
    this.presentation.consumeAll(events);
    for (const listener of this.eventListeners) listener(events);
  }
}
