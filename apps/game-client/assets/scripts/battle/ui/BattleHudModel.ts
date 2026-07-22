import type { BattleState } from "@skymenders/battle-core";
import { factionSemantic } from "../../accessibility/accessibility.js";
import type { ClientSettings } from "../../settings/settings.js";

export function buildBattleHud(state: BattleState, settings: ClientSettings) {
  return {
    phaseKey: `phase.${state.phase}`,
    turnIndex: state.turnIndex,
    energy: { current: state.energy.current, maximum: state.energy.maximum },
    actors: state.actors.map((actor) => ({
      id: actor.id,
      team: actor.team,
      hp: actor.hp,
      maxHp: actor.maxHp,
      structuralDamage: actor.structuralDamage,
      disabled: actor.disabled,
      semantic: factionSemantic(actor.team, settings),
      modules: [actor.mainModuleId, ...actor.auxiliaryModuleIds],
    })),
    objectives: state.objectives.map((objective) => ({
      id: objective.id,
      role: objective.role,
      status: objective.status,
      progress: objective.progress,
      required: objective.required,
      textKey: `objective.${objective.trigger}`,
    })),
  } as const;
}
