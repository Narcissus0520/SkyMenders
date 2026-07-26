import type { PveContentPack } from "@skymenders/content-schema";

import type { ExpeditionState, RewardDefinition, RobotRunState, RunModifiers } from "./types.js";

export function buyWorkshopService(
  pack: PveContentPack,
  state: ExpeditionState,
  serviceId: string,
  robotId: string,
  targetId?: string,
): ExpeditionState {
  if (state.status !== "active")
    throw new Error("workshop is unavailable outside an active expedition");
  const service = pack.routes.workshopServices.find((candidate) => candidate.id === serviceId);
  if (service === undefined) throw new Error(`workshop service not found: ${serviceId}`);
  if (state.supplies < service.cost)
    throw new Error(`insufficient supplies for workshop service: ${serviceId}`);
  const robot = state.robots.find((candidate) => candidate.robotId === robotId);
  if (robot === undefined) throw new Error(`robot not found in squad: ${robotId}`);
  let robots = state.robots;
  let inventory = state.inventory;
  if (service.kind === "repair_hp") {
    robots = state.robots.map((candidate) =>
      service.scope === "squad" || candidate.robotId === robotId
        ? applyRepair(candidate, "repair_hp", service.amount)
        : candidate,
    );
  } else if (service.kind === "repair_structure") {
    robots = state.robots.map((candidate) =>
      service.scope === "squad" || candidate.robotId === robotId
        ? applyRepair(candidate, "repair_structure", service.amount)
        : candidate,
    );
  } else if (service.kind === "install_module") {
    if (targetId === undefined || !pack.modules.modules.some((module) => module.id === targetId)) {
      throw new Error("workshop module target is invalid");
    }
    if (inventory.moduleIds.includes(targetId))
      throw new Error(`workshop module already installed: ${targetId}`);
    inventory = {
      ...inventory,
      moduleIds: Array.from(new Set([...inventory.moduleIds, targetId])).sort(),
    };
  } else {
    const route = pack.modules.modules
      .flatMap((module) => module.routes)
      .find((candidate) => candidate.id === targetId);
    if (route === undefined) throw new Error("workshop upgrade target is invalid");
    const owner = pack.modules.modules.find((module) =>
      module.routes.some((candidate) => candidate.id === route.id),
    );
    if (owner === undefined || !inventory.moduleIds.includes(owner.id))
      throw new Error("workshop upgrade requires its module");
    if (inventory.upgradeRouteIds.includes(route.id))
      throw new Error(`workshop upgrade already installed: ${route.id}`);
    rejectMutuallyExclusiveRoute(owner, inventory.upgradeRouteIds, route.id);
    inventory = {
      ...inventory,
      upgradeRouteIds: Array.from(new Set([...inventory.upgradeRouteIds, route.id])).sort(),
    };
  }
  return { ...state, robots, inventory, supplies: state.supplies - service.cost };
}

function applyRepair(
  robot: RobotRunState,
  kind: "repair_hp" | "repair_structure",
  amount: number,
): RobotRunState {
  return kind === "repair_hp"
    ? { ...robot, hp: Math.min(robot.maxHp, robot.hp + amount), disabled: false }
    : { ...robot, structuralDamage: Math.max(0, robot.structuralDamage - amount) };
}

export function applyEventChoice(
  pack: PveContentPack,
  state: ExpeditionState,
  eventId: string,
  choiceId: string,
): ExpeditionState {
  const event = pack.events.events.find((candidate) => candidate.id === eventId);
  const choice = event?.choices.find((candidate) => candidate.id === choiceId);
  if (choice === undefined) throw new Error(`event choice not found: ${eventId}/${choiceId}`);
  let result = state;
  for (const effect of choice.effects) {
    if (effect.kind === "research" || effect.kind === "trade_research")
      result = { ...result, researchEarned: Math.max(0, result.researchEarned + effect.amount) };
    else if (effect.kind === "energy_supply")
      result = { ...result, supplies: Math.max(0, result.supplies + effect.amount) };
    else if (effect.kind === "grant_consumable")
      result = {
        ...result,
        inventory: {
          ...result.inventory,
          consumables: Math.max(0, result.inventory.consumables + effect.amount),
        },
      };
    else if (effect.kind === "reveal_route")
      result = {
        ...result,
        routeRevealDepth: Math.max(1, Math.min(3, result.routeRevealDepth + effect.amount)),
      };
    else if (effect.kind === "repair_hp")
      result = {
        ...result,
        robots: result.robots.map((robot) => ({
          ...robot,
          hp: Math.max(0, Math.min(robot.maxHp, robot.hp + effect.amount)),
        })),
      };
    else
      result = {
        ...result,
        robots: result.robots.map((robot) => ({
          ...robot,
          structuralDamage: Math.max(0, Math.min(100, robot.structuralDamage - effect.amount)),
        })),
      };
  }
  return result;
}

export function claimReward(
  pack: PveContentPack,
  state: ExpeditionState,
  reward: RewardDefinition,
): ExpeditionState {
  const inventory = state.inventory;
  if (reward.kind === "module" && reward.moduleId !== null) {
    return {
      ...state,
      inventory: {
        ...inventory,
        moduleIds: Array.from(new Set([...inventory.moduleIds, reward.moduleId])).sort(),
      },
    };
  }
  if (reward.kind === "upgrade" && reward.routeId !== null) {
    if (reward.moduleId === null || !inventory.moduleIds.includes(reward.moduleId))
      throw new Error("reward upgrade requires its module");
    const owner = pack.modules.modules.find((module) => module.id === reward.moduleId);
    if (!owner?.routes.some((route) => route.id === reward.routeId))
      throw new Error("reward upgrade route does not belong to its module");
    rejectMutuallyExclusiveRoute(owner, inventory.upgradeRouteIds, reward.routeId);
    return {
      ...state,
      inventory: {
        ...inventory,
        upgradeRouteIds: Array.from(new Set([...inventory.upgradeRouteIds, reward.routeId])).sort(),
      },
    };
  }
  if (reward.kind === "temporary_mod")
    return {
      ...state,
      inventory: {
        ...inventory,
        temporaryModIds: Array.from(new Set([...inventory.temporaryModIds, reward.id])).sort(),
      },
    };
  if (reward.kind === "consumable")
    return { ...state, inventory: { ...inventory, consumables: inventory.consumables + 1 } };
  if (reward.kind === "intel")
    return { ...state, routeRevealDepth: Math.min(3, state.routeRevealDepth + 1) };
  throw new Error(`reward definition cannot be claimed: ${reward.id}`);
}

export function deriveRunModifiers(pack: PveContentPack, state: ExpeditionState): RunModifiers {
  let movementEfficiencyPermille = 1_000;
  let energyMaximumBonus = 0;
  let fallDamageReductionPermille = 0;
  let repairEfficiencyPermille = 1_000;
  for (const rewardId of state.inventory.temporaryModIds) {
    const reward = pack.routes.rewardPool.find((candidate) => candidate.id === rewardId);
    const effect = reward?.temporaryEffect;
    if (reward?.kind !== "temporary_mod" || effect === undefined)
      throw new Error(`temporary modifier definition not found: ${rewardId}`);
    if (effect.kind === "movement_efficiency_permille") movementEfficiencyPermille += effect.amount;
    else if (effect.kind === "energy_maximum_bonus") energyMaximumBonus += effect.amount;
    else if (effect.kind === "fall_damage_reduction_permille")
      fallDamageReductionPermille = Math.min(900, fallDamageReductionPermille + effect.amount);
    else repairEfficiencyPermille += effect.amount;
  }
  return {
    movementEfficiencyPermille,
    energyMaximumBonus,
    fallDamageReductionPermille,
    repairEfficiencyPermille,
  };
}

function rejectMutuallyExclusiveRoute(
  owner: PveContentPack["modules"]["modules"][number],
  installedRouteIds: readonly string[],
  routeId: string,
): void {
  if (
    owner.routes.some(
      (candidate) => candidate.id !== routeId && installedRouteIds.includes(candidate.id),
    )
  )
    throw new Error(`mutually exclusive upgrade route already installed for ${owner.id}`);
}
