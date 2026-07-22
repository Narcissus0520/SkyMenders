import { terrainIndex } from "@skymenders/terrain-core";

import { updateBattleOutcome } from "./objectives.js";
import { findBattleActor, replaceBattleActor } from "./state.js";
import type {
  BattleActor,
  BattleRuleConfig,
  BattleRuleEffect,
  BattleState,
  BattleTransition,
  StructuralFault,
  StructuralFaultKind,
  StructuralFaultSource,
} from "./types.js";

export interface DurabilityDamage {
  readonly hpDamage: number;
  readonly structuralDamage: number;
  readonly source: StructuralFaultSource;
  readonly sourceId: string;
}

export function applyActorDurabilityDamage(
  state: BattleState,
  actorId: string,
  damage: DurabilityDamage,
): BattleTransition {
  assertDamage(damage);
  const actor = findBattleActor(state, actorId);
  if (actor.disabled) return { state, effects: [] };
  const stabilized = state.fieldEffects.some(
    (effect) =>
      effect.kind === "stabilizer" && effect.targetActorId === actorId && !effect.consumed,
  );
  const bubbled = state.fieldEffects.some(
    (effect) => effect.kind === "bubble" && effect.targetActorId === actorId && !effect.consumed,
  );
  const stabilityFault = actor.faults.find((fault) => fault.kind === "stability_fault");
  const stabilityPenalty =
    stabilityFault !== undefined && (damage.source === "fall" || damage.source === "collision")
      ? stabilityFault.severity === "major"
        ? 10
        : 5
      : 0;
  const hpDamage = bubbled ? Math.trunc(damage.hpDamage / 2) : damage.hpDamage;
  const structuralDamage =
    stabilized && (damage.source === "fall" || damage.source === "collision")
      ? Math.trunc((damage.structuralDamage + stabilityPenalty) / 2)
      : damage.structuralDamage + stabilityPenalty;
  const hp = Math.max(0, actor.hp - hpDamage);
  const structure = Math.min(100, actor.structuralDamage + structuralDamage);
  const faults = updateFaults(actor.faults, actor.structuralDamage, structure, damage.source);
  const disabled = hp === 0;
  const updated: BattleActor = {
    ...actor,
    hp,
    structuralDamage: structure,
    faults,
    disabled,
    recoveryBeaconId: disabled ? `beacon:${actor.id}` : actor.recoveryBeaconId,
    actionEnded: disabled || actor.actionEnded,
  };
  let next = replaceBattleActor(state, updated);
  const effects: BattleRuleEffect[] = [];
  if (hp !== actor.hp) {
    effects.push(
      effect("actor_damaged", damage.sourceId, actor.id, actor.x, actor.y, actor.hp - hp),
    );
  }
  if (structure !== actor.structuralDamage) {
    effects.push(
      effect(
        "structural_damage_changed",
        damage.sourceId,
        actor.id,
        actor.x,
        actor.y,
        structure - actor.structuralDamage,
      ),
    );
  }
  if (
    faults.length !== actor.faults.length ||
    faults.some((fault, index) => fault !== actor.faults[index])
  ) {
    effects.push({
      ...effect("fault_changed", damage.sourceId, actor.id, actor.x, actor.y, faults.length),
      details: { source: damage.source, severity: structure >= 60 ? "major" : "minor" },
    });
  }
  if (disabled) {
    const drop = dropCarriedObject(next, updated);
    next = drop.state;
    effects.push(...drop.effects);
    next = {
      ...next,
      statistics: { ...next.statistics, robotsDisabled: next.statistics.robotsDisabled + 1 },
    };
    effects.push({
      ...effect("actor_disabled", damage.sourceId, actor.id, actor.x, actor.y, 1),
      details: { beaconId: `beacon:${actor.id}` },
    });
  }
  return { state: updateBattleOutcome(next), effects };
}

export function repairBattleActor(
  state: BattleState,
  actorId: string,
  amount: number,
  sourceId: string,
): BattleTransition {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new RangeError("actor repair amount must be positive");
  }
  const actor = findBattleActor(state, actorId);
  if (actor.disabled) throw new Error("disabled actor cannot be repaired during battle");
  const hp = Math.min(actor.maxHp, actor.hp + amount);
  if (hp === actor.hp) return { state, effects: [] };
  return {
    state: replaceBattleActor(state, { ...actor, hp }),
    effects: [effect("actor_repaired", sourceId, actor.id, actor.x, actor.y, hp - actor.hp)],
  };
}

export function recoverTeamAfterNode(state: BattleState, config: BattleRuleConfig): BattleState {
  const actors = state.actors.map((actor): BattleActor => {
    if (actor.team !== "player") return actor;
    const recoveredHp = actor.disabled
      ? Math.max(1, Math.trunc((actor.maxHp * config.disabledRecoveryPermille) / 1_000))
      : Math.min(
          actor.maxHp,
          actor.hp + Math.trunc((actor.maxHp * config.survivorRecoveryPermille) / 1_000),
        );
    const structuralDamage = Math.max(0, actor.structuralDamage - config.nodeStructuralRepair);
    const recoveredFaultSeverity: StructuralFault["severity"] =
      structuralDamage >= 60 ? "major" : "minor";
    return {
      ...actor,
      hp: recoveredHp,
      structuralDamage,
      faults:
        structuralDamage < 30
          ? []
          : actor.faults.map((fault) => ({ ...fault, severity: recoveredFaultSeverity })),
      disabled: false,
      recoveryBeaconId: null,
      movementUsed: false,
      mainModuleUsed: false,
      actionEnded: false,
      auxiliaryUses: 0,
    };
  });
  return { ...state, actors };
}

function updateFaults(
  faults: readonly StructuralFault[],
  before: number,
  after: number,
  source: StructuralFaultSource,
): readonly StructuralFault[] {
  if (after < 30) return [];
  const kind = faultForSource(source);
  const severity: StructuralFault["severity"] = after >= 60 ? "major" : "minor";
  const normalizedFaults = faults.map((fault) => ({ ...fault, severity }));
  const existingIndex = normalizedFaults.findIndex((fault) => fault.kind === kind);
  if (existingIndex >= 0) {
    return normalizedFaults
      .map((fault, index) => (index === existingIndex ? { kind, source, severity } : fault))
      .sort(compareFault);
  }
  if (before < 60 || normalizedFaults.length < 2) {
    return [...normalizedFaults, { kind, source, severity }].sort(compareFault).slice(0, 2);
  }
  return normalizedFaults;
}

function dropCarriedObject(state: BattleState, actor: BattleActor): BattleTransition {
  if (actor.carriedObjectId === null) return { state, effects: [] };
  const object = state.worldObjects.find((candidate) => candidate.id === actor.carriedObjectId);
  if (object === undefined) throw new Error(`carried object not found: ${actor.carriedObjectId}`);
  const point = nearestSafeDrop(state, actor.x, actor.y);
  return {
    state: {
      ...replaceBattleActor(state, { ...actor, carriedObjectId: null }),
      worldObjects: state.worldObjects.map((candidate) =>
        candidate.id === object.id
          ? { ...candidate, x: point.x, y: point.y, active: true }
          : candidate,
      ),
    },
    effects: [effect("world_object_moved", actor.id, object.id, point.x, point.y, 1)],
  };
}

function nearestSafeDrop(
  state: BattleState,
  originX: number,
  originY: number,
): { readonly x: number; readonly y: number } {
  const occupied = new Set(
    state.actors.filter((actor) => !actor.disabled).map((actor) => `${actor.x}:${actor.y}`),
  );
  const candidates: { x: number; y: number; distance: number }[] = [];
  for (let y = 1; y < state.terrain.height; y += 1) {
    for (let x = 0; x < state.terrain.width; x += 1) {
      const current = state.terrain.materials[terrainIndex(state.terrain.width, x, y)] ?? 0;
      const below = state.terrain.materials[terrainIndex(state.terrain.width, x, y - 1)] ?? 0;
      if (current === 0 && below !== 0 && !occupied.has(`${x}:${y}`)) {
        candidates.push({ x, y, distance: Math.abs(x - originX) + Math.abs(y - originY) });
      }
    }
  }
  candidates.sort(
    (left, right) => left.distance - right.distance || left.y - right.y || left.x - right.x,
  );
  const point = candidates[0];
  if (point === undefined) throw new Error("no deterministic safe drop point exists");
  return { x: point.x, y: point.y };
}

function assertDamage(damage: DurabilityDamage): void {
  if (
    !Number.isSafeInteger(damage.hpDamage) ||
    damage.hpDamage < 0 ||
    !Number.isSafeInteger(damage.structuralDamage) ||
    damage.structuralDamage < 0
  ) {
    throw new RangeError("durability damage must use non-negative safe integers");
  }
}

function faultForSource(source: StructuralFaultSource): StructuralFaultKind {
  switch (source) {
    case "fall":
      return "mobility_fault";
    case "overload":
      return "cooling_fault";
    case "collision":
      return "stability_fault";
    case "magnetic":
      return "aiming_fault";
  }
}

function compareFault(left: StructuralFault, right: StructuralFault): number {
  return left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0;
}

function effect(
  kind: BattleRuleEffect["kind"],
  sourceId: string,
  targetId: string,
  targetX: number,
  targetY: number,
  magnitude: number,
): BattleRuleEffect {
  return { kind, sourceId, targetId, targetX, targetY, magnitude, duration: 0, details: {} };
}
