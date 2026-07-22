import { createTerrainState } from "@skymenders/terrain-core";

import type {
  BattleActor,
  BattleObjective,
  BattleState,
  CreateBattleDefinition,
  ModuleRouteSelection,
} from "../src/index.js";
import { createBattleState } from "../src/index.js";

const ACTOR_SPECS = [
  ["player:1", "player", 1, "main_fold_bridge", ["aux_repair_spray", "aux_reflector"]],
  ["player:2", "player", 4, "main_drill_bee", ["aux_ejector", "aux_stabilizer"]],
  ["player:3", "player", 7, "main_magnetic_anchor", ["aux_route_scanner", "aux_energy_recycler"]],
  ["enemy:1", "enemy", 10, "main_gravity_pin", ["aux_grapple", "aux_terrain_foam"]],
  ["enemy:2", "enemy", 13, "main_bubble_capsule", ["aux_jammer", "aux_structure_scanner"]],
  ["enemy:3", "enemy", 16, "main_wind_generator", ["aux_repair_spray", "aux_reflector"]],
  ["enemy:4", "enemy", 19, "main_support_frame", ["aux_ejector", "aux_stabilizer"]],
  ["enemy:5", "enemy", 22, "main_energy_rail", ["aux_route_scanner", "aux_energy_recycler"]],
] as const;

export interface BattleFixtureOptions {
  readonly routes?: Readonly<Record<string, readonly ModuleRouteSelection[]>>;
  readonly actorOverrides?: Readonly<Record<string, Partial<BattleActor>>>;
  readonly objectives?: readonly BattleObjective[];
  readonly definitionOverrides?: Partial<CreateBattleDefinition>;
}

export function battleFixture(options: BattleFixtureOptions = {}): BattleState {
  const terrain = createTerrainState({
    width: 24,
    height: 12,
    fills: [{ x: 0, y: 0, width: 24, height: 1, materialId: "terrain_alloy_frame" }],
    supportRoots: [{ id: "anchor:test", kind: "fixed_anchor", x: 0, y: 0, capacity: 100_000 }],
  });
  const actors = ACTOR_SPECS.map(
    ([id, team, x, mainModuleId, auxiliaryModuleIds]): BattleActor => ({
      id,
      team,
      x,
      y: 1,
      hp: 100,
      maxHp: 100,
      structuralDamage: 0,
      faults: [],
      disabled: false,
      recoveryBeaconId: null,
      carriedObjectId: null,
      movementUsed: false,
      mainModuleUsed: false,
      actionEnded: false,
      auxiliaryUses: 0,
      mainModuleId,
      auxiliaryModuleIds,
      selectedRoutes: options.routes?.[id] ?? [],
      cooldowns: [],
      ...options.actorOverrides?.[id],
    }),
  );
  const objectives: readonly BattleObjective[] = options.objectives ?? [
    {
      id: "objective:primary",
      role: "primary",
      trigger: "repair_energy_tower",
      progress: 0,
      required: 2,
      status: "active",
      criticalInteraction: true,
      requiredModuleId: null,
      targetId: "tower:1",
    },
  ];
  return createBattleState({
    battleId: "battle:test",
    terrain,
    actors,
    objectives,
    worldObjects: [
      { id: "object:metal", kind: "metal_object", x: 11, y: 2, mass: 100, active: true },
      { id: "object:core", kind: "task_object", x: 14, y: 2, mass: 80, active: true },
      { id: "object:relic", kind: "relic", x: 18, y: 2, mass: 300, active: true },
    ],
    ...options.definitionOverrides,
  });
}

export function commandBase(
  actorId: string,
  turnIndex = 0,
  commandId = `cmd:${actorId.replace(":", "-")}`,
) {
  return { commandId, battleId: "battle:test", turnIndex, actorId } as const;
}

export function moduleCommand(
  state: BattleState,
  actorId: string,
  moduleId: string,
  targetX?: number,
  targetY?: number,
  angleMilliDegrees = 0,
) {
  const actor = state.actors.find((candidate) => candidate.id === actorId);
  if (actor === undefined) throw new Error("fixture actor missing");
  return {
    ...commandBase(actorId, state.turnIndex, `cmd:${moduleId}:${actorId}`),
    kind: "use_module" as const,
    moduleId,
    originX: actor.x,
    originY: actor.y,
    angleMilliDegrees,
    powerPermille: 750,
    ...(targetX === undefined || targetY === undefined ? {} : { targetX, targetY }),
  };
}
