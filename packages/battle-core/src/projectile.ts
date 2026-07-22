import { manhattanDistance } from "./state.js";
import type {
  BattleFieldEffect,
  BattleProjectileResolution,
  BattleProjectileState,
  BattleRuleEffect,
  BattleState,
} from "./types.js";

export function applyBattleFieldsToProjectile(
  state: BattleState,
  input: BattleProjectileState,
): BattleProjectileResolution {
  assertProjectile(input);
  let projectile = input;
  let next = state;
  const effects: BattleRuleEffect[] = [];
  const fields = [...state.fieldEffects].sort(compareField);
  for (const field of fields) {
    if (field.consumed || manhattanDistance(projectile, field) > field.radius) continue;
    switch (field.kind) {
      case "gravity_field": {
        const vector = cardinalDirection(field.directionMilliDegrees);
        projectile = {
          ...projectile,
          velocityX: projectile.velocityX + Math.trunc((vector.x * field.magnitude) / 10),
          velocityY: projectile.velocityY + Math.trunc((vector.y * field.magnitude) / 10),
        };
        break;
      }
      case "wind_field": {
        const vector = cardinalDirection(field.directionMilliDegrees);
        projectile = {
          ...projectile,
          velocityX: projectile.velocityX + Math.trunc((vector.x * field.magnitude) / 20),
          velocityY: projectile.velocityY + Math.trunc((vector.y * field.magnitude) / 20),
        };
        break;
      }
      case "energy_rail": {
        const vector = cardinalDirection(field.directionMilliDegrees);
        const speed = Math.max(1, Math.abs(projectile.velocityX) + Math.abs(projectile.velocityY));
        const redirected = Math.trunc((speed * field.magnitude) / 1_000);
        projectile = {
          ...projectile,
          velocityX: vector.x * redirected,
          velocityY: vector.y * redirected,
          power: Math.max(1, Math.trunc((projectile.power * field.magnitude) / 1_000)),
        };
        break;
      }
      case "reflector": {
        projectile =
          field.magnitude >= 2
            ? {
                ...projectile,
                velocityX: -projectile.velocityY,
                velocityY: -projectile.velocityX,
                reflectionCount: projectile.reflectionCount + 1,
              }
            : {
                ...projectile,
                velocityX: -projectile.velocityX,
                reflectionCount: projectile.reflectionCount + 1,
              };
        next = consumeField(next, field.id);
        effects.push(projectileEffect(field, projectile, "reflector"));
        break;
      }
      case "bubble": {
        if (field.magnitude >= 900) {
          projectile = {
            ...projectile,
            velocityX: -projectile.velocityX,
            velocityY: -projectile.velocityY,
            power: Math.trunc(projectile.power / 2),
            reflectionCount: projectile.reflectionCount + 1,
          };
          next = consumeField(next, field.id);
          effects.push(projectileEffect(field, projectile, "bubble_rebound"));
        }
        break;
      }
      case "conductive_bridge": {
        projectile = {
          ...projectile,
          power: projectile.power + field.magnitude,
        };
        break;
      }
      case "energy_recycler":
      case "jammer":
      case "route_scan":
      case "stabilizer":
      case "structure_scan":
      case "temporary_foam":
        break;
    }
  }
  if (projectile.reflectionCount > input.reflectionCount) {
    next = {
      ...next,
      statistics: {
        ...next.statistics,
        reflectedHits:
          next.statistics.reflectedHits + projectile.reflectionCount - input.reflectionCount,
      },
    };
  }
  return { state: next, projectile, effects };
}

export function jammerTargetScoreModifier(state: BattleState, x: number, y: number): number {
  return state.fieldEffects
    .filter(
      (field) =>
        field.kind === "jammer" &&
        !field.consumed &&
        manhattanDistance(field, { x, y }) <= field.radius,
    )
    .reduce((modifier, field) => modifier - field.magnitude, 0);
}

function assertProjectile(projectile: BattleProjectileState): void {
  for (const value of [
    projectile.x,
    projectile.y,
    projectile.velocityX,
    projectile.velocityY,
    projectile.power,
    projectile.reflectionCount,
  ]) {
    if (!Number.isSafeInteger(value))
      throw new RangeError("projectile values must be safe integers");
  }
  if (projectile.power < 0 || projectile.reflectionCount < 0) {
    throw new RangeError("projectile power and reflection count must be non-negative");
  }
}

function consumeField(state: BattleState, fieldId: string): BattleState {
  return {
    ...state,
    fieldEffects: state.fieldEffects.map((field) =>
      field.id === fieldId ? { ...field, consumed: true } : field,
    ),
  };
}

function projectileEffect(
  field: BattleFieldEffect,
  projectile: BattleProjectileState,
  interaction: string,
): BattleRuleEffect {
  return {
    kind: "field_expired",
    sourceId: field.sourceActorId,
    targetId: field.id,
    targetX: projectile.x,
    targetY: projectile.y,
    magnitude: projectile.reflectionCount,
    duration: 0,
    details: { interaction, projectileId: projectile.id },
  };
}

function cardinalDirection(angleMilliDegrees: number): { readonly x: number; readonly y: number } {
  const quadrant = Math.floor(((angleMilliDegrees + 45_000) % 360_000) / 90_000);
  return [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ][quadrant] as { readonly x: number; readonly y: number };
}

function compareField(left: BattleFieldEffect, right: BattleFieldEffect): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
