import {
  BOSS_IDS,
  createAiAuthorityState,
  createBossActor,
  createEnemyActor,
  ELITE_TEMPLATE_IDS,
  ENEMY_PROTOTYPE_IDS,
  getEliteTemplate,
} from "@skymenders/ai-core";
import type {
  AiAuthorityState,
  AiControllerState,
  BossId,
  EliteTemplateId,
  EnemyPrototypeId,
} from "@skymenders/ai-core";
import type { BattleActor, BattleObjective, BattleState, ModuleId } from "@skymenders/battle-core";
import { createBattleState } from "@skymenders/battle-core";
import {
  findTargetDurationPath,
  generateExpeditionPlan,
  materializeMapTemplate,
} from "@skymenders/content-runtime";
import type { PveContentPack } from "@skymenders/content-schema";
import { deriveRngState, hashCanonical, nextInteger } from "@skymenders/deterministic-runtime";
import { DAILY_REPLAY_SCHEMA_VERSION, dailyChallengeDefinitionSchema } from "@skymenders/protocol";
import type { DailyChallengeDefinition } from "@skymenders/protocol";

import { businessDateAt, nextBusinessReset } from "./calendar.js";

export interface DailyChallengeOptions {
  readonly instant: Date;
  readonly timeZone: string;
  readonly seedSecret: string;
  readonly rulesVersion: string;
  readonly contentVersion: string;
}

export function createDailyChallenge(
  pack: PveContentPack,
  options: DailyChallengeOptions,
): DailyChallengeDefinition {
  if (options.seedSecret.length < 32) throw new Error("daily challenge seed secret is too short");
  if (pack.robots.contentVersion !== options.contentVersion)
    throw new Error("daily challenge content version is unavailable");
  const businessDate = businessDateAt(options.instant, options.timeZone);
  const seedHash = hashCanonical({
    businessDate,
    contentVersion: options.contentVersion,
    rulesVersion: options.rulesVersion,
    secret: options.seedSecret,
  });
  const seed = Number.parseInt(seedHash.slice(0, 8), 16) >>> 0;
  const plan = generateExpeditionPlan(pack, seed);
  const path = findTargetDurationPath(pack, plan);
  if (path === null) throw new Error("daily challenge has no valid target-duration route");
  const allNodes = new Map(
    plan.regions
      .flatMap((region) => region.layers.flatMap((layer) => layer))
      .map((node) => [node.id, node]),
  );
  const route = path.nodeIds.map((nodeId, index) => {
    const node = allNodes.get(nodeId);
    if (node === undefined) throw new Error(`daily route node is missing: ${nodeId}`);
    return {
      nodeId,
      type: node.type,
      mapId: node.mapId,
      eventId: node.eventId,
      bossId: node.bossId,
      rewardSeed: derivedUint32(seed, `reward:${index}:${nodeId}`),
    };
  });
  const shuffledRobots = deterministicShuffle(pack.robots.robots, seed, "daily-squad");
  const selected = shuffledRobots.slice(0, 3);
  if (selected.length !== 3) throw new Error("daily challenge requires three authored robots");
  const loadouts = selected.map((robot) => ({
    robotId: robot.id,
    mainModuleId: robot.mainModuleId,
    auxiliaryModuleIds: robot.auxiliaryModuleIds,
  })) as DailyChallengeDefinition["loadouts"];
  const difficulties = ["normal", "hard", "expert"] as const;
  const unsigned = {
    challengeId: `${businessDate}:${options.rulesVersion}:${options.contentVersion}:${seed}`,
    businessDate,
    resetsAt: nextBusinessReset(options.instant, options.timeZone).toISOString(),
    seed,
    rulesVersion: options.rulesVersion,
    contentVersion: options.contentVersion,
    replaySchemaVersion: DAILY_REPLAY_SCHEMA_VERSION,
    difficulty: difficulties[seed % difficulties.length] ?? "normal",
    initialEnergy: 12,
    initialHp: 100,
    loadouts,
    route,
  };
  return dailyChallengeDefinitionSchema.parse({
    ...unsigned,
    definitionHash: hashCanonical(unsigned),
  });
}

export function createDailyBattleState(
  pack: PveContentPack,
  challenge: DailyChallengeDefinition,
  nodeId: string,
): BattleState {
  const node = challenge.route.find((candidate) => candidate.nodeId === nodeId);
  if (node?.mapId === null || node === undefined) throw new Error("daily node has no battle map");
  const map = pack.maps.maps.find((candidate) => candidate.id === node.mapId);
  if (map === undefined) throw new Error(`daily battle map is unavailable: ${node.mapId}`);
  const terrain = materializeMapTemplate(map).terrain;
  const players = challenge.loadouts.map((loadout, index) =>
    actor(
      `player:${loadout.robotId}`,
      "player",
      map.playerSpawns[index]?.x ?? 1 + index * 2,
      map.playerSpawns[index]?.y ?? map.floorY + 1,
      challenge.initialHp,
      loadout.mainModuleId as ModuleId,
      loadout.auxiliaryModuleIds as readonly [ModuleId, ModuleId],
    ),
  );
  const enemyCount = Math.max(1, map.enemySpawns.length);
  const enemies = Array.from({ length: enemyCount }, (_, index) => {
    const position = map.enemySpawns[index] ?? map.enemySpawns[0];
    if (position === undefined) throw new Error("daily battle map has no enemy spawn");
    const actorId = `enemy:${node.nodeId}:${index}`;
    const profile = dailyEnemyProfile(node, index);
    return profile.bossId === null
      ? createEnemyActor(actorId, profile.prototypeId, position.x, position.y)
      : createBossActor(actorId, profile.bossId, position.x, position.y);
  });
  const objectives = objectiveRoles(pack, map);
  return createBattleState({
    battleId: `daily:${challenge.challengeId}:${node.nodeId}`,
    terrain,
    actors: [...players, ...enemies],
    objectives,
    initialEnergy: challenge.initialEnergy,
    initialEnemyEnergy: challenge.initialEnergy,
  });
}

export function createDailyAiState(
  challenge: DailyChallengeDefinition,
  nodeId: string,
  battle: BattleState,
): AiAuthorityState {
  const node = challenge.route.find((candidate) => candidate.nodeId === nodeId);
  if (node === undefined) throw new Error(`daily AI node is unavailable: ${nodeId}`);
  const controllers: AiControllerState[] = battle.actors
    .filter((candidate) => candidate.team === "enemy")
    .map((candidate, index) => {
      const profile = dailyEnemyProfile(node, index);
      return {
        actorId: candidate.id,
        prototypeId: profile.bossId === null ? profile.prototypeId : null,
        eliteTemplateId: profile.bossId === null ? profile.eliteTemplateId : null,
        bossId: profile.bossId,
      };
    });
  return createAiAuthorityState({
    rootSeed: derivedUint32(challenge.seed, `ai:${node.nodeId}`),
    difficulty: challenge.difficulty,
    controllers,
  });
}

export function isDailyBattleNode(node: DailyChallengeDefinition["route"][number]): boolean {
  return node.mapId !== null && ["battle", "engineering", "elite", "boss"].includes(node.type);
}

function objectiveRoles(
  pack: PveContentPack,
  map: PveContentPack["maps"]["maps"][number],
): BattleObjective[] {
  const ids = [map.primaryObjectiveIds[0], map.secondaryObjectiveIds[0], map.hiddenObjectiveIds[0]];
  return ids.flatMap((objectiveId) => {
    const definition = pack.objectives.objectives.find((entry) => entry.id === objectiveId);
    if (definition === undefined) return [];
    return [
      {
        id: `daily:${definition.id}`,
        role: definition.role,
        trigger: definition.trigger,
        progress: 0,
        required: definition.role === "primary" ? 1 : definition.required,
        status: "active",
        criticalInteraction: definition.role === "primary",
        requiredModuleId: null,
        targetId: `target:${definition.id}`,
      } satisfies BattleObjective,
    ];
  });
}

function actor(
  id: string,
  team: "player" | "enemy",
  x: number,
  y: number,
  hp: number,
  mainModuleId: ModuleId,
  auxiliaryModuleIds: readonly [ModuleId, ModuleId],
): BattleActor {
  return {
    id,
    team,
    x,
    y,
    hp,
    maxHp: hp,
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

function dailyEnemyProfile(
  node: DailyChallengeDefinition["route"][number],
  index: number,
): {
  readonly prototypeId: EnemyPrototypeId;
  readonly eliteTemplateId: EliteTemplateId | null;
  readonly bossId: BossId | null;
} {
  if (index === 0 && node.bossId !== null) {
    const bossId = BOSS_IDS.find((candidate) => candidate === node.bossId);
    if (bossId === undefined) throw new Error(`daily boss is not supported by AI: ${node.bossId}`);
    return { prototypeId: "enemy_guard", eliteTemplateId: null, bossId };
  }
  if (node.type === "elite") {
    const templateId =
      ELITE_TEMPLATE_IDS[(node.rewardSeed + index) % ELITE_TEMPLATE_IDS.length] ??
      "elite_stable_scout";
    return {
      prototypeId: getEliteTemplate(templateId).prototypeId,
      eliteTemplateId: templateId,
      bossId: null,
    };
  }
  return {
    prototypeId:
      ENEMY_PROTOTYPE_IDS[(node.rewardSeed + index) % ENEMY_PROTOTYPE_IDS.length] ?? "enemy_scout",
    eliteTemplateId: null,
    bossId: null,
  };
}

function derivedUint32(seed: number, stream: string): number {
  return Number.parseInt(hashCanonical({ seed, stream }).slice(0, 8), 16) >>> 0;
}

function deterministicShuffle<T>(values: readonly T[], seed: number, stream: string): T[] {
  const result = [...values];
  let rng = deriveRngState(derivedUint32(seed, stream), "reward");
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = nextInteger(rng, 0, index);
    rng = selected.state;
    [result[index], result[selected.value]] = [result[selected.value] as T, result[index] as T];
  }
  return result;
}
