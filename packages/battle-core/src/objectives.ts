import type {
  BattleObjective,
  BattleRuleEffect,
  BattleState,
  BattleTransition,
  ObjectiveTrigger,
} from "./types.js";

export interface ObjectiveSignal {
  readonly trigger: ObjectiveTrigger;
  readonly sourceId: string;
  readonly targetId: string | null;
  readonly amount: number;
}

export function applyObjectiveSignal(
  state: BattleState,
  signal: ObjectiveSignal,
): BattleTransition {
  if (!Number.isSafeInteger(signal.amount) || signal.amount <= 0) {
    throw new RangeError("objective signal amount must be a positive safe integer");
  }
  const effects: BattleRuleEffect[] = [];
  const objectives = state.objectives.map((objective) => {
    if (
      objective.status !== "active" ||
      objective.trigger !== signal.trigger ||
      (objective.targetId !== null && objective.targetId !== signal.targetId)
    ) {
      return objective;
    }
    const progress = Math.min(objective.required, objective.progress + signal.amount);
    const completed = progress === objective.required;
    effects.push(objectiveEffect(signal, objective, "objective_progressed", progress));
    if (completed) {
      effects.push(objectiveEffect(signal, objective, "objective_completed", progress));
    }
    return { ...objective, progress, status: completed ? "completed" : "active" } as const;
  });
  return { state: updateBattleOutcome({ ...state, objectives }), effects };
}

export function updateBattleOutcome(state: BattleState): BattleState {
  if (state.outcome.status !== "ongoing") return state;
  const players = state.actors.filter((actor) => actor.team === "player");
  if (players.length > 0 && players.every((actor) => actor.disabled)) {
    return {
      ...state,
      phase: "battle_complete",
      outcome: { status: "defeat", reason: "team_disabled" },
    };
  }
  const primary = state.objectives.find((objective) => objective.role === "primary");
  if (primary?.status === "failed") {
    return {
      ...state,
      phase: "battle_complete",
      outcome: { status: "defeat", reason: "primary_failed" },
    };
  }
  if (primary?.status === "completed") {
    return {
      ...state,
      phase: "battle_complete",
      outcome: { status: "victory", reason: "primary_completed" },
    };
  }
  return state;
}

export function failObjective(
  state: BattleState,
  objectiveId: string,
  sourceId: string,
): BattleTransition {
  const objective = state.objectives.find((candidate) => candidate.id === objectiveId);
  if (objective === undefined) throw new Error(`objective not found: ${objectiveId}`);
  if (objective.status !== "active") return { state, effects: [] };
  return {
    state: updateBattleOutcome({
      ...state,
      objectives: state.objectives.map((candidate) =>
        candidate.id === objectiveId ? { ...candidate, status: "failed" } : candidate,
      ),
    }),
    effects: [
      {
        kind: "objective_progressed",
        sourceId,
        targetId: objective.id,
        targetX: null,
        targetY: null,
        magnitude: 0,
        duration: 0,
        details: { status: "failed", trigger: objective.trigger },
      },
    ],
  };
}

function objectiveEffect(
  signal: ObjectiveSignal,
  objective: BattleObjective,
  kind: "objective_progressed" | "objective_completed",
  progress: number,
): BattleRuleEffect {
  return {
    kind,
    sourceId: signal.sourceId,
    targetId: objective.id,
    targetX: null,
    targetY: null,
    magnitude: progress,
    duration: 0,
    details: { required: objective.required, role: objective.role, trigger: objective.trigger },
  };
}
