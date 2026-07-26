import { deriveRngState, nextInteger } from "@skymenders/deterministic-runtime";
import type { RngState } from "@skymenders/deterministic-runtime";

import type { PveContentPack } from "@skymenders/content-schema";

import type {
  ExpeditionNode,
  ExpeditionNodeType,
  ExpeditionDurationPath,
  ExpeditionPlan,
  ExpeditionRegionPlan,
  ExpeditionState,
  NodeOutcome,
  RouteNodeVisibility,
  RobotId,
  RobotRunState,
} from "./types.js";

const BATTLE_NODE_TYPES = new Set<ExpeditionNodeType>(["battle", "engineering", "elite"]);

export function generateExpeditionPlan(pack: PveContentPack, seed: number): ExpeditionPlan {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff)
    throw new RangeError("expedition seed must be a uint32");
  let mapRng = deriveRngState(seed, "map");
  let eventRng = deriveRngState(seed, "event");
  const regions: ExpeditionRegionPlan[] = [];
  for (const region of [...pack.regions.regions].sort((left, right) => left.index - right.index)) {
    const countResult = nextInteger(mapRng, 4, 6);
    mapRng = countResult.state;
    const firstCount = Math.ceil(countResult.value / 2);
    const secondCount = countResult.value - firstCount;
    const first = createLayer(pack, region, 0, firstCount, mapRng, eventRng);
    mapRng = first.mapRng;
    eventRng = first.eventRng;
    const second = createLayer(pack, region, 1, secondCount, mapRng, eventRng);
    mapRng = second.mapRng;
    eventRng = second.eventRng;
    const bossId = `region_${region.index}_boss`;
    const boss: ExpeditionNode = {
      id: bossId,
      regionIndex: region.index,
      layer: 2,
      type: "boss",
      mapId: pack.bosses.bosses.find((candidate) => candidate.id === region.bossId)?.mapId ?? null,
      eventId: null,
      bossId: region.bossId,
      risk: 3,
      nextNodeIds: [],
    };
    const secondIds = second.nodes.map((node) => node.id);
    const connectedFirst = first.nodes.map((node) => ({ ...node, nextNodeIds: secondIds }));
    const connectedSecond = second.nodes.map((node) => ({ ...node, nextNodeIds: [bossId] }));
    regions.push({
      id: region.id,
      regionIndex: region.index,
      layers: [connectedFirst, connectedSecond, [boss]],
    });
  }
  const connectedRegions: ExpeditionRegionPlan[] = regions.map((region, index) => {
    const nextIds = regions[index + 1]?.layers[0].map((node) => node.id) ?? [];
    const boss = region.layers[2][0];
    return {
      ...region,
      layers: [region.layers[0], region.layers[1], [{ ...boss, nextNodeIds: nextIds }]],
    };
  });
  return {
    schemaVersion: "0.1.0",
    contentVersion: pack.regions.contentVersion,
    rulesVersion: "0.6.0",
    seed,
    regions: connectedRegions,
  };
}

export function findTargetDurationPath(
  pack: PveContentPack,
  plan: ExpeditionPlan,
): ExpeditionDurationPath | null {
  const [minimum, maximum] = pack.routes.route.targetDurationMinutes;
  const target = Math.trunc((minimum + maximum) / 2);
  let candidates: ExpeditionDurationPath[] = [{ nodeIds: [], estimatedMinutes: 0 }];
  for (const region of plan.regions) {
    const boss = region.layers[2][0];
    const regionPaths = region.layers[0].flatMap((first) =>
      region.layers[1].map((second) => ({
        nodeIds: [first.id, second.id, boss.id],
        estimatedMinutes:
          nodeMinutes(pack, first.type) +
          nodeMinutes(pack, second.type) +
          nodeMinutes(pack, boss.type),
      })),
    );
    candidates = candidates.flatMap((prefix) =>
      regionPaths.map((path) => ({
        nodeIds: [...prefix.nodeIds, ...path.nodeIds],
        estimatedMinutes: prefix.estimatedMinutes + path.estimatedMinutes,
      })),
    );
  }
  return (
    candidates
      .filter(
        (candidate) =>
          candidate.estimatedMinutes >= minimum && candidate.estimatedMinutes <= maximum,
      )
      .sort(
        (left, right) =>
          Math.abs(target - left.estimatedMinutes) - Math.abs(target - right.estimatedMinutes) ||
          compareText(left.nodeIds.join(":"), right.nodeIds.join(":")),
      )[0] ?? null
  );
}

function nodeMinutes(pack: PveContentPack, type: ExpeditionNodeType): number {
  return pack.routes.route.nodeDurationMinutes[type];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function createLayer(
  pack: PveContentPack,
  region: PveContentPack["regions"]["regions"][number],
  layer: 0 | 1,
  count: number,
  initialMapRng: RngState,
  initialEventRng: RngState,
): { readonly nodes: ExpeditionNode[]; readonly mapRng: RngState; readonly eventRng: RngState } {
  let mapRng = initialMapRng;
  let eventRng = initialEventRng;
  const nodes: ExpeditionNode[] = [];
  const ordinaryNodePool = region.nodePool.filter((type) => type !== "boss");
  if (ordinaryNodePool.length === 0)
    throw new Error(`region has no ordinary node type: ${region.id}`);
  const shortestNodeType = ordinaryNodePool.reduce((shortest, candidate) =>
    nodeMinutes(pack, candidate) < nodeMinutes(pack, shortest) ? candidate : shortest,
  );
  const shortestNodeMinutes = nodeMinutes(pack, shortestNodeType);
  let includesShortestDuration = false;
  for (let index = 0; index < count; index += 1) {
    const typeResult = nextInteger(mapRng, 0, ordinaryNodePool.length - 1);
    mapRng = typeResult.state;
    const type: ExpeditionNodeType =
      index === count - 1 && !includesShortestDuration
        ? shortestNodeType
        : (ordinaryNodePool[typeResult.value] ?? shortestNodeType);
    includesShortestDuration ||= nodeMinutes(pack, type) === shortestNodeMinutes;
    const bossMapId = pack.bosses.bosses.find((boss) => boss.id === region.bossId)?.mapId;
    const compatibleMapIds = BATTLE_NODE_TYPES.has(type)
      ? region.mapIds.filter((mapId) => {
          const map = pack.maps.maps.find((candidate) => candidate.id === mapId);
          return mapId !== bossMapId && map?.nodeTypes.includes(type);
        })
      : [];
    if (BATTLE_NODE_TYPES.has(type) && compatibleMapIds.length === 0)
      throw new Error(`region has no ${type} map: ${region.id}`);
    const mapResult = nextInteger(mapRng, 0, Math.max(0, compatibleMapIds.length - 1));
    mapRng = mapResult.state;
    const eventPool = pack.events.events.filter((event) => event.regionIds.includes(region.id));
    const eventResult = nextInteger(eventRng, 0, Math.max(0, eventPool.length - 1));
    eventRng = eventResult.state;
    nodes.push({
      id: `region_${region.index}_layer_${layer}_node_${index}`,
      regionIndex: region.index,
      layer,
      type,
      mapId: BATTLE_NODE_TYPES.has(type) ? (compatibleMapIds[mapResult.value] ?? null) : null,
      eventId: type === "event" ? (eventPool[eventResult.value]?.id ?? null) : null,
      bossId: null,
      risk: Math.min(3, region.index + (type === "elite" ? 1 : 0)) as 1 | 2 | 3,
      nextNodeIds: [],
    });
  }
  return { nodes, mapRng, eventRng };
}

export function createExpeditionState(
  plan: ExpeditionPlan,
  robotIds: readonly RobotId[],
  initialModuleIds: readonly string[] = [],
): ExpeditionState {
  if (robotIds.length !== 3 || new Set(robotIds).size !== 3)
    throw new Error("an expedition squad must contain three distinct robots");
  const robots: RobotRunState[] = robotIds.map((robotId) => ({
    robotId,
    hp: 100,
    maxHp: 100,
    structuralDamage: 0,
    disabled: false,
  }));
  return {
    plan,
    status: "active",
    regionIndex: 1,
    layer: 0,
    completedNodeIds: [],
    robots,
    researchEarned: 0,
    supplies: 0,
    routeRevealDepth: 1,
    inventory: {
      moduleIds: Array.from(new Set(initialModuleIds)).sort(),
      upgradeRouteIds: [],
      temporaryModIds: [],
      consumables: 0,
    },
    restartUsedNodeIds: [],
  };
}

export function availableNodes(state: ExpeditionState): readonly ExpeditionNode[] {
  if (state.status !== "active") return [];
  return state.plan.regions[state.regionIndex - 1]?.layers[state.layer] ?? [];
}

export function routeVisibility(state: ExpeditionState): readonly RouteNodeVisibility[] {
  if (state.status !== "active") return [];
  const region = state.plan.regions[state.regionIndex - 1];
  if (region === undefined) return [];
  return region.layers.flatMap((nodes, layer) =>
    nodes.map((node) => {
      const distance = layer - state.layer;
      const revealed = distance <= state.routeRevealDepth;
      return {
        id: node.id,
        layer: node.layer,
        type: revealed ? node.type : null,
        risk: revealed ? node.risk : null,
        current: layer === state.layer,
      };
    }),
  );
}

export function useNodeRestart(state: ExpeditionState, nodeId: string): ExpeditionState {
  if (!availableNodes(state).some((node) => node.id === nodeId))
    throw new Error(`node is not currently available: ${nodeId}`);
  if (state.restartUsedNodeIds.includes(nodeId))
    throw new Error(`node restart already used: ${nodeId}`);
  return { ...state, restartUsedNodeIds: [...state.restartUsedNodeIds, nodeId] };
}

export function completeExpeditionNode(
  state: ExpeditionState,
  nodeId: string,
  outcome: NodeOutcome,
): ExpeditionState {
  if (state.status !== "active") throw new Error("expedition is not active");
  if (
    !Number.isSafeInteger(outcome.researchEarned) ||
    outcome.researchEarned < 0 ||
    !Number.isSafeInteger(outcome.suppliesEarned) ||
    outcome.suppliesEarned < 0
  )
    throw new RangeError("node rewards must be non-negative safe integers");
  const node = availableNodes(state).find((candidate) => candidate.id === nodeId);
  if (node === undefined) throw new Error(`node is not currently available: ${nodeId}`);
  const allDisabled = state.robots.every(
    (robot) => (outcome.robotHp[robot.robotId] ?? robot.hp) <= 0,
  );
  const robots = state.robots.map((robot) => recoverRobot(robot, outcome));
  if (!outcome.victory || allDisabled) {
    return {
      ...state,
      status: "defeat",
      robots,
      completedNodeIds: [...state.completedNodeIds, nodeId],
    };
  }
  const completedNodeIds = [...state.completedNodeIds, nodeId];
  if (state.layer < 2) {
    return {
      ...state,
      layer: (state.layer + 1) as 1 | 2,
      robots,
      completedNodeIds,
      researchEarned: state.researchEarned + outcome.researchEarned,
      supplies: state.supplies + outcome.suppliesEarned,
    };
  }
  if (state.regionIndex === 4) {
    return {
      ...state,
      status: "victory",
      robots,
      completedNodeIds,
      researchEarned: state.researchEarned + outcome.researchEarned,
      supplies: state.supplies + outcome.suppliesEarned,
    };
  }
  return {
    ...state,
    regionIndex: state.regionIndex + 1,
    layer: 0,
    robots,
    completedNodeIds,
    researchEarned: state.researchEarned + outcome.researchEarned,
    supplies: state.supplies + outcome.suppliesEarned,
  };
}

function recoverRobot(robot: RobotRunState, outcome: NodeOutcome): RobotRunState {
  const rawHp = outcome.robotHp[robot.robotId] ?? robot.hp;
  const damage = outcome.structuralDamage[robot.robotId] ?? robot.structuralDamage;
  if (!Number.isSafeInteger(rawHp) || !Number.isSafeInteger(damage) || damage < 0 || damage > 100)
    throw new RangeError("robot outcome is invalid");
  const disabled = rawHp <= 0;
  const recovery = Math.trunc((robot.maxHp * (disabled ? 350 : 150)) / 1000);
  return {
    ...robot,
    hp: Math.min(robot.maxHp, Math.max(0, rawHp) + recovery),
    structuralDamage: Math.max(0, damage - 10),
    disabled: false,
  };
}
