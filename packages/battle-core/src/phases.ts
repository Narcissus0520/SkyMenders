import {
  analyzeTerrainSupport,
  applyTerrainDamage,
  removeTerrainSupportRoot,
  resolveTerrainCollapse,
} from "@skymenders/terrain-core";

import { applyActorDurabilityDamage } from "./durability.js";
import { applyObjectiveSignal, failObjective } from "./objectives.js";
import { replaceBattleActor, terrainIntegrityPermille } from "./state.js";
import type {
  BattleActor,
  BattleRuleEffect,
  BattleState,
  BattleTransition,
  BattleWorldObject,
} from "./types.js";

export function advanceBattlePhase(state: BattleState): BattleTransition {
  switch (state.phase) {
    case "player_planning":
      return { state: { ...state, phase: "player_action" }, effects: [] };
    case "player_action":
      assertTeamFinished(state, "player");
      return { state: { ...state, phase: "enemy_action" }, effects: [] };
    case "enemy_action":
      assertTeamFinished(state, "enemy");
      return { state: { ...state, phase: "environment_settlement" }, effects: [] };
    case "environment_settlement":
      return settleEnvironment(state);
    case "battle_complete":
      throw new Error("completed battle cannot advance phase");
  }
}

function settleEnvironment(state: BattleState): BattleTransition {
  let next = state;
  const effects: BattleRuleEffect[] = [];

  const survivingFields = [];
  for (const field of next.fieldEffects) {
    if (field.consumed || field.remainingRounds <= 1) {
      effects.push({
        kind: "field_expired",
        sourceId: field.sourceActorId,
        targetId: field.id,
        targetX: field.x,
        targetY: field.y,
        magnitude: 0,
        duration: 0,
        details: { fieldKind: field.kind },
      });
    } else {
      survivingFields.push({ ...field, remainingRounds: field.remainingRounds - 1 });
    }
  }
  next = { ...next, fieldEffects: survivingFields };

  const survivingSupports = [];
  let terrain = next.terrain;
  for (const support of next.temporarySupports) {
    if (support.remainingRounds <= 1) {
      terrain = removeTerrainSupportRoot(terrain, support.rootId);
      effects.push({
        kind: "support_expired",
        sourceId: support.effectId,
        targetId: support.rootId,
        targetX: null,
        targetY: null,
        magnitude: 0,
        duration: 0,
        details: {},
      });
    } else {
      survivingSupports.push({ ...support, remainingRounds: support.remainingRounds - 1 });
    }
  }

  const survivingTerrain = [];
  for (const temporary of next.temporaryTerrain) {
    if (temporary.remainingRounds <= 1) {
      let removedCells = 0;
      for (const cell of temporary.cells) {
        const damage = applyTerrainDamage(terrain, { ...cell, radius: 0, energy: 10_000 });
        terrain = damage.state;
        removedCells += damage.affectedCells.length;
      }
      effects.push({
        kind: "terrain_damaged",
        sourceId: temporary.effectId,
        targetId: null,
        targetX: temporary.cells[0]?.x ?? null,
        targetY: temporary.cells[0]?.y ?? null,
        magnitude: removedCells,
        duration: 0,
        details: { reason: "temporary_terrain_expired" },
      });
    } else {
      survivingTerrain.push({ ...temporary, remainingRounds: temporary.remainingRounds - 1 });
    }
  }

  const analysis = analyzeTerrainSupport(terrain);
  const collapse = resolveTerrainCollapse(terrain, analysis);
  terrain = collapse.state;
  if (collapse.events.length > 0) {
    effects.push({
      kind: "terrain_collapsed",
      sourceId: "environment",
      targetId: null,
      targetX: null,
      targetY: null,
      magnitude: collapse.events.reduce(
        (count, event) => count + event.sourceCellIndices.length,
        0,
      ),
      duration: 0,
      details: { blocks: collapse.events.length },
    });
  }

  const entitySettlement = settleEntities({ ...next, terrain }, terrain);
  next = entitySettlement.state;
  effects.push(...entitySettlement.effects);

  const actors = next.actors.map(resetActorForRound);
  const regenerated = Math.min(
    next.energy.maximum,
    next.energy.current + next.energy.regenerationPerRound,
  );
  const regeneration = regenerated - next.energy.current;
  if (regeneration > 0) {
    effects.push({
      kind: "energy_changed",
      sourceId: "environment",
      targetId: null,
      targetX: null,
      targetY: null,
      magnitude: regeneration,
      duration: 0,
      details: { reason: "round_regeneration" },
    });
  }
  next = {
    ...next,
    turnIndex: next.turnIndex + 1,
    phase: next.outcome.status === "ongoing" ? "player_planning" : "battle_complete",
    actors,
    terrain,
    temporarySupports: survivingSupports,
    temporaryTerrain: survivingTerrain,
    energy: {
      ...next.energy,
      current: regenerated,
      waitEnergyGrantedThisRound: 0,
    },
    statistics: {
      ...next.statistics,
      terrainIntegrityPermille: terrainIntegrityPermille(
        terrain,
        next.statistics.terrainInitialIntegrity,
      ),
    },
  };

  if (next.outcome.status !== "ongoing") return { state: next, effects };

  const hold = applyObjectiveSignal(next, {
    trigger: "hold_round",
    sourceId: "environment",
    targetId: null,
    amount: 1,
  });
  next = hold.state;
  effects.push(...hold.effects);
  if (next.outcome.status === "ongoing" && next.statistics.terrainIntegrityPermille > 0) {
    const integrity = applyObjectiveSignal(next, {
      trigger: "terrain_integrity",
      sourceId: "environment",
      targetId: null,
      amount: next.statistics.terrainIntegrityPermille,
    });
    next = integrity.state;
    effects.push(...integrity.effects);
  }
  return { state: next, effects };
}

function settleEntities(state: BattleState, terrain: BattleState["terrain"]): BattleTransition {
  let next: BattleState = { ...state, terrain };
  const effects: BattleRuleEffect[] = [];
  const occupied = new Set(
    [
      ...next.actors.filter((actor) => !actor.disabled),
      ...next.worldObjects.filter((object) => object.active),
    ].map((entity) => positionKey(entity.x, entity.y)),
  );
  const objects = [...next.worldObjects].sort(compareEntitiesForFall);
  for (const object of objects) {
    if (!object.active) continue;
    occupied.delete(positionKey(object.x, object.y));
    const landingY = landingYFor(terrain, object.x, object.y, occupied);
    if (landingY === null) {
      next = replaceWorldObject(next, { ...object, active: false });
      effects.push({
        kind: "world_object_moved",
        sourceId: "environment",
        targetId: object.id,
        targetX: null,
        targetY: null,
        magnitude: object.y + 1,
        duration: 0,
        details: { reason: "fell_out_of_battle" },
      });
      const failedObjectives = next.objectives.filter(
        (objective) => objective.status === "active" && objective.targetId === object.id,
      );
      for (const objective of failedObjectives) {
        const failed = failObjective(next, objective.id, "environment");
        next = failed.state;
        effects.push(...failed.effects);
      }
      continue;
    }
    occupied.add(positionKey(object.x, landingY));
    if (landingY === object.y) continue;
    next = replaceWorldObject(next, { ...object, y: landingY });
    effects.push({
      kind: "world_object_moved",
      sourceId: "environment",
      targetId: object.id,
      targetX: object.x,
      targetY: landingY,
      magnitude: object.y - landingY,
      duration: 0,
      details: { reason: "unsupported_fall" },
    });
  }

  const actors = [...next.actors].sort(compareEntitiesForFall);
  for (const actor of actors) {
    if (actor.disabled) continue;
    occupied.delete(positionKey(actor.x, actor.y));
    const landingY = landingYFor(terrain, actor.x, actor.y, occupied);
    if (landingY === null) {
      const disabled = applyActorDurabilityDamage(next, actor.id, {
        hpDamage: actor.hp,
        structuralDamage: 100,
        source: "fall",
        sourceId: "environment:void",
      });
      next = disabled.state;
      effects.push(...disabled.effects);
      continue;
    }
    const key = positionKey(actor.x, landingY);
    occupied.add(key);
    const fallDistance = actor.y - landingY;
    if (fallDistance > 0) {
      next = replaceBattleActor(next, { ...actor, y: landingY });
      effects.push({
        kind: "actor_moved",
        sourceId: "environment",
        targetId: actor.id,
        targetX: actor.x,
        targetY: landingY,
        magnitude: fallDistance,
        duration: 0,
        details: { reason: "unsupported_fall" },
      });
    }
    const unsafeDistance = Math.max(0, fallDistance - state.config.safeFallDistance);
    if (unsafeDistance === 0) continue;
    const damaged = applyActorDurabilityDamage(next, actor.id, {
      hpDamage: unsafeDistance * state.config.fallHpDamagePerCell,
      structuralDamage: unsafeDistance * state.config.fallStructuralDamagePerCell,
      source: "fall",
      sourceId: "environment:fall",
    });
    next = damaged.state;
    effects.push(...damaged.effects);
    if (next.actors.find((candidate) => candidate.id === actor.id)?.disabled === true) {
      occupied.delete(key);
    }
  }
  return { state: next, effects };
}

function landingYFor(
  terrain: BattleState["terrain"],
  x: number,
  originY: number,
  occupied: ReadonlySet<string>,
): number | null {
  let floorY = -1;
  for (let y = originY - 1; y >= 0; y -= 1) {
    if ((terrain.materials[y * terrain.width + x] ?? 0) !== 0) {
      floorY = y;
      break;
    }
  }
  if (floorY < 0) return null;
  let landingY = floorY + 1;
  while (landingY < originY && occupied.has(positionKey(x, landingY))) landingY += 1;
  return landingY;
}

function replaceWorldObject(state: BattleState, object: BattleWorldObject): BattleState {
  return {
    ...state,
    worldObjects: state.worldObjects.map((candidate) =>
      candidate.id === object.id ? object : candidate,
    ),
  };
}

function compareEntitiesForFall(
  left: { readonly id: string; readonly x: number; readonly y: number },
  right: { readonly id: string; readonly x: number; readonly y: number },
): number {
  return left.y - right.y || left.x - right.x || compareText(left.id, right.id);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function positionKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function assertTeamFinished(state: BattleState, team: "player" | "enemy"): void {
  const active = state.actors.filter((actor) => actor.team === team && !actor.disabled);
  if (active.some((actor) => !actor.actionEnded)) {
    throw new Error(`${team} action phase cannot end before every active actor acts`);
  }
}

function resetActorForRound(actor: BattleActor): BattleActor {
  return {
    ...actor,
    movementUsed: false,
    mainModuleUsed: false,
    actionEnded: actor.disabled,
    auxiliaryUses: 0,
    cooldowns: actor.cooldowns
      .map((cooldown) => ({
        ...cooldown,
        remainingRounds: Math.max(0, cooldown.remainingRounds - 1),
      }))
      .filter((cooldown) => cooldown.remainingRounds > 0),
  };
}
