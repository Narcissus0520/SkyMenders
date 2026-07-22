import { createBattleState, reduceBattleCommand } from "@skymenders/battle-core";
import type { BattleActor, BattleState } from "@skymenders/battle-core";
import { createTerrainState } from "@skymenders/terrain-core";

import { createAiAuthorityState, createBossActor, createEnemyActor } from "../src/index.js";
import type {
  AiAuthorityState,
  AiControllerState,
  BossId,
  EliteTemplateId,
  EnemyPrototypeId,
} from "../src/index.js";

export interface AiActorSpec {
  readonly prototypeId?: EnemyPrototypeId;
  readonly eliteTemplateId?: EliteTemplateId;
  readonly bossId?: BossId;
}

export interface AiFixture {
  readonly battle: BattleState;
  readonly ai: AiAuthorityState;
}

export function aiFixture(
  specs: readonly AiActorSpec[] = [{ prototypeId: "enemy_scout" }],
  difficulty: AiAuthorityState["difficulty"] = "hard",
  rootSeed = 0x51a7_f00d,
): AiFixture {
  const terrain = createTerrainState({
    width: 64,
    height: 16,
    fills: [{ x: 0, y: 0, width: 64, height: 1, materialId: "terrain_alloy_frame" }],
    supportRoots: [{ id: "anchor:ai", kind: "fixed_anchor", x: 0, y: 0, capacity: 100_000 }],
  });
  const players: BattleActor[] = [
    playerActor("player:1", 3, "main_drill_bee", ["aux_jammer", "aux_repair_spray"]),
    playerActor("player:2", 7, "main_magnetic_anchor", ["aux_grapple", "aux_stabilizer"]),
    playerActor("player:3", 11, "main_gravity_pin", ["aux_terrain_foam", "aux_reflector"]),
  ];
  const controllers: AiControllerState[] = [];
  const enemies = specs.map((spec, index) => {
    const actorId = `enemy:${index + 1}`;
    const x = 24 + index * 4;
    if (spec.bossId !== undefined) {
      controllers.push({
        actorId,
        prototypeId: null,
        eliteTemplateId: null,
        bossId: spec.bossId,
      });
      return createBossActor(actorId, spec.bossId, x, 1);
    }
    const prototypeId = spec.prototypeId ?? "enemy_scout";
    controllers.push({
      actorId,
      prototypeId,
      eliteTemplateId: spec.eliteTemplateId ?? null,
      bossId: null,
    });
    return createEnemyActor(actorId, prototypeId, x, 1);
  });
  let battle = createBattleState({
    battleId: "battle:ai",
    terrain,
    actors: [...players, ...enemies],
    objectives: [
      {
        id: "objective:primary",
        role: "primary",
        trigger: "deliver_energy_core",
        progress: 0,
        required: 3,
        status: "active",
        criticalInteraction: true,
        requiredModuleId: null,
        targetId: "object:core",
      },
    ],
    worldObjects: [
      { id: "object:core", kind: "task_object", x: 16, y: 1, mass: 80, active: true },
      { id: "object:metal", kind: "metal_object", x: 20, y: 1, mass: 120, active: true },
    ],
  });
  battle = reduceBattleCommand(
    battle,
    systemAdvance(battle, "player_planning", "cmd:phase:planning"),
    0,
  ).state;
  for (let index = 0; index < players.length; index += 1) {
    const player = players[index];
    if (player === undefined) throw new Error("player fixture missing");
    battle = reduceBattleCommand(
      battle,
      {
        kind: "wait",
        commandId: `cmd:player-wait:${index}`,
        battleId: battle.battleId,
        turnIndex: battle.turnIndex,
        actorId: player.id,
      },
      index + 1,
    ).state;
  }
  battle = reduceBattleCommand(
    battle,
    systemAdvance(battle, "player_action", "cmd:phase:player"),
    4,
  ).state;
  return {
    battle,
    ai: createAiAuthorityState({ rootSeed, difficulty, controllers }),
  };
}

export function playerActionFixture(spec: AiActorSpec = { bossId: "boss_rift_drill" }): AiFixture {
  const fixture = aiFixture([spec]);
  const battle = {
    ...fixture.battle,
    phase: "player_action" as const,
    actors: fixture.battle.actors.map((actor) =>
      actor.team === "player"
        ? { ...actor, actionEnded: false, movementUsed: false, mainModuleUsed: false }
        : actor,
    ),
  };
  return { ...fixture, battle };
}

function playerActor(
  id: string,
  x: number,
  mainModuleId: BattleActor["mainModuleId"],
  auxiliaryModuleIds: BattleActor["auxiliaryModuleIds"],
): BattleActor {
  return {
    id,
    team: "player",
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
    selectedRoutes: [],
    cooldowns: [],
  };
}

function systemAdvance(
  battle: BattleState,
  expectedPhase: "player_planning" | "player_action",
  commandId: string,
) {
  return {
    kind: "advance_phase" as const,
    commandId,
    battleId: battle.battleId,
    turnIndex: battle.turnIndex,
    actorId: "system",
    expectedPhase,
  };
}
