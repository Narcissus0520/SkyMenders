import { getModuleDefinition } from "./module-registry.js";
import { createBattleState, effectiveModuleEnergyCost } from "./state.js";
import type {
  BattleValidationIssue,
  BattleValidationReport,
  CreateBattleDefinition,
} from "./types.js";

export function validateBattleDefinition(
  definition: CreateBattleDefinition,
): BattleValidationReport {
  const issues: BattleValidationIssue[] = [];
  let state;
  try {
    state = createBattleState(definition);
  } catch (error) {
    issues.push({
      code: "BATTLE_STATE_INVALID",
      path: "battle",
      message: error instanceof Error ? error.message : "battle definition is invalid",
    });
    return report(issues);
  }
  if (state.config.basicRepairHp <= 0 || state.config.basicPushDistance <= 0) {
    issues.push({
      code: "FALLBACK_ACTION_MISSING",
      path: "config",
      message: "zero-energy basic repair and push must remain usable",
    });
  }
  for (const [index, objective] of state.objectives.entries()) {
    const path = `objectives[${index}]`;
    if (objective.criticalInteraction && objective.requiredModuleId !== null) {
      issues.push({
        code: "OBJECTIVE_INTERACTION_AMBIGUOUS",
        path,
        message: "critical interaction objectives cannot also require a module",
      });
    }
    if (objective.criticalInteraction && objective.targetId === null) {
      issues.push({
        code: "OBJECTIVE_TARGET_MISSING",
        path: `${path}.targetId`,
        message: "critical interaction objective requires a stable target id",
      });
    }
    if (objective.requiredModuleId !== null) {
      const requiredModuleId = objective.requiredModuleId;
      const equipped = state.actors.filter(
        (actor) =>
          actor.mainModuleId === requiredModuleId ||
          actor.auxiliaryModuleIds.includes(requiredModuleId),
      );
      if (equipped.length === 0) {
        issues.push({
          code: "OBJECTIVE_MODULE_UNEQUIPPED",
          path: `${path}.requiredModuleId`,
          message: `required module ${objective.requiredModuleId} is not equipped`,
        });
      } else if (
        equipped.every(
          (actor) => effectiveModuleEnergyCost(actor, requiredModuleId) > state.energy.maximum,
        )
      ) {
        issues.push({
          code: "OBJECTIVE_ENERGY_DEADLOCK",
          path: `${path}.requiredModuleId`,
          message: `required module ${objective.requiredModuleId} exceeds theoretical energy maximum`,
        });
      }
    }
  }
  for (const [actorIndex, actor] of state.actors.entries()) {
    for (const moduleId of [actor.mainModuleId, ...actor.auxiliaryModuleIds]) {
      if (getModuleDefinition(moduleId).energyCost > state.energy.maximum) {
        issues.push({
          code: "MODULE_ENERGY_UNUSABLE",
          path: `actors[${actorIndex}]`,
          message: `equipped module ${moduleId} can never be paid from the energy maximum`,
        });
      }
    }
  }
  return report(issues);
}

function report(issues: BattleValidationIssue[]): BattleValidationReport {
  issues.sort(
    (left, right) =>
      compareText(left.code, right.code) ||
      compareText(left.path, right.path) ||
      compareText(left.message, right.message),
  );
  return { valid: issues.length === 0, issues };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
