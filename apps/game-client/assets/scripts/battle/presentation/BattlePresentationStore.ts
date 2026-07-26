import { parseBattleEvent } from "@skymenders/protocol/battle-event";
import type { BattleEvent } from "@skymenders/protocol/battle-event";

export interface VisualCue {
  readonly id: string;
  readonly kind: "movement" | "module" | "effect" | "phase" | "status";
  readonly sourceId: string;
  readonly textKey: string;
  readonly x: number | null;
  readonly y: number | null;
}

export class BattlePresentationStore {
  private readonly cues: VisualCue[] = [];
  constructor(readonly maximumCues = 256) {
    if (!Number.isInteger(maximumCues) || maximumCues < 1 || maximumCues > 1_024)
      throw new RangeError("visual cue limit is invalid");
  }

  consume(input: unknown): VisualCue | null {
    const event = parseBattleEvent(input);
    const cue = toCue(event);
    if (cue === null) return null;
    this.cues.push(cue);
    while (this.cues.length > this.maximumCues) this.cues.shift();
    return cue;
  }

  consumeAll(events: readonly unknown[]): void {
    for (const event of events) this.consume(event);
  }
  snapshot(): readonly VisualCue[] {
    return [...this.cues];
  }
  drain(): readonly VisualCue[] {
    return this.cues.splice(0, this.cues.length);
  }
}

function toCue(event: BattleEvent): VisualCue | null {
  if (event.kind === "actor_moved")
    return cue(event, "movement", event.actorId, "battle.actor_moved", event.toX, event.toY);
  if (event.kind === "module_resolved")
    return cue(event, "module", event.actorId, `module.${event.moduleId}.resolved`, null, null);
  if (event.kind === "battle_effect_applied")
    return cue(
      event,
      "effect",
      event.sourceId,
      `effect.${event.effectKind}`,
      event.targetX ?? null,
      event.targetY ?? null,
    );
  if (event.kind === "battle_phase_changed")
    return cue(event, "phase", "system", `phase.${event.toPhase}`, null, null);
  if (event.kind === "turn_waited")
    return cue(event, "status", event.actorId, "battle.turn_waited", null, null);
  return null;
}

function cue(
  event: BattleEvent,
  kind: VisualCue["kind"],
  sourceId: string,
  textKey: string,
  x: number | null,
  y: number | null,
): VisualCue {
  return { id: `${event.battleId}:${event.sequence}`, kind, sourceId, textKey, x, y };
}
