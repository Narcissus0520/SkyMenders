import { describe, expect, it } from "vitest";

import {
  availableNodes,
  completeExpeditionNode,
  createExpeditionState,
  findTargetDurationPath,
  generateExpeditionPlan,
  materializeMapTemplate,
  routeVisibility,
  useNodeRestart,
  validateAuthoredMaps,
} from "../src/index.js";

import { loadPack } from "./fixture.js";

const pack = loadPack();
const squad = ["robot_rivet", "robot_anchor", "robot_gale"] as const;
const victory = {
  victory: true,
  robotHp: { robot_rivet: 70, robot_anchor: 0, robot_gale: 90 },
  structuralDamage: { robot_rivet: 25, robot_anchor: 55, robot_gale: 5 },
  researchEarned: 3,
  suppliesEarned: 2,
};

describe("expedition route and lifecycle", () => {
  it("builds four regions with 4-6 candidates and an explicit boss", () => {
    const plan = generateExpeditionPlan(pack, 42);
    expect(plan.regions).toHaveLength(4);
    for (const region of plan.regions) {
      expect(region.layers[0].length + region.layers[1].length).toBeGreaterThanOrEqual(4);
      expect(region.layers[0].length + region.layers[1].length).toBeLessThanOrEqual(6);
      expect(region.layers[2][0]).toMatchObject({ type: "boss", risk: 3 });
      expect(
        region.layers[0].every((node) => node.nextNodeIds.length === region.layers[1].length),
      ).toBe(true);
      expect(region.layers[1].every((node) => node.nextNodeIds[0] === region.layers[2][0].id)).toBe(
        true,
      );
      expect(
        region.layers
          .slice(0, 2)
          .flat()
          .filter((node) => node.mapId !== null)
          .every((node) => !node.mapId?.startsWith("map_boss")),
      ).toBe(true);
      expect(
        region.layers
          .slice(0, 2)
          .every((layer) =>
            layer.some((node) => pack.routes.route.nodeDurationMinutes[node.type] === 2),
          ),
      ).toBe(true);
    }
    expect(plan.regions[0]?.layers[2][0].nextNodeIds).toEqual(
      plan.regions[1]?.layers[0].map((node) => node.id),
    );
  });

  it("finds a complete twelve-node route inside the 35-45 minute target", () => {
    for (let seed = 0; seed < 250; seed += 1) {
      const path = findTargetDurationPath(pack, generateExpeditionPlan(pack, seed));
      expect(path?.nodeIds).toHaveLength(12);
      expect(path?.estimatedMinutes).toBeGreaterThanOrEqual(35);
      expect(path?.estimatedMinutes).toBeLessThanOrEqual(45);
    }
  });

  it("materializes every authored template into a valid deterministic terrain map", () => {
    const reports = validateAuthoredMaps(pack);
    expect(reports).toHaveLength(16);
    expect(reports.every((report) => report.valid && report.metrics.unstableCells === 0)).toBe(
      true,
    );
    const template = pack.maps.maps[0];
    if (template === undefined) throw new Error("map template missing");
    expect(materializeMapTemplate(template).terrain.width).toBe(template.width);
  });

  it("completes a twelve-node expedition with configured recovery", () => {
    let state = createExpeditionState(generateExpeditionPlan(pack, 9), squad);
    for (let index = 0; index < 12; index += 1) {
      const node = availableNodes(state)[0];
      if (node === undefined) throw new Error("node missing");
      state = completeExpeditionNode(state, node.id, victory);
    }
    expect(state.status).toBe("victory");
    expect(state.completedNodeIds).toHaveLength(12);
    expect(state.researchEarned).toBe(36);
    expect(state.supplies).toBe(24);
    expect(state.robots.find((robot) => robot.robotId === "robot_anchor")).toMatchObject({
      hp: 35,
      structuralDamage: 45,
      disabled: false,
    });
    expect(availableNodes(state)).toEqual([]);
  });

  it("enforces squad, node, restart, reward, and outcome boundaries", () => {
    const plan = generateExpeditionPlan(pack, 1);
    expect(() => generateExpeditionPlan(pack, -1)).toThrow("uint32");
    expect(() => createExpeditionState(plan, ["robot_rivet", "robot_rivet", "robot_gale"])).toThrow(
      "distinct",
    );
    let state = createExpeditionState(plan, squad);
    expect(routeVisibility(state).filter((node) => node.type === null).length).toBeGreaterThan(0);
    const node = availableNodes(state)[0];
    if (node === undefined) throw new Error("node missing");
    expect(() => useNodeRestart(state, "missing")).toThrow("not currently available");
    state = useNodeRestart(state, node.id);
    expect(() => useNodeRestart(state, node.id)).toThrow("already used");
    expect(() => completeExpeditionNode(state, "missing", victory)).toThrow(
      "not currently available",
    );
    expect(() =>
      completeExpeditionNode(state, node.id, { ...victory, researchEarned: -1 }),
    ).toThrow("non-negative");
    expect(() =>
      completeExpeditionNode(state, node.id, {
        ...victory,
        structuralDamage: { robot_rivet: 101 },
      }),
    ).toThrow("invalid");
    const defeated = completeExpeditionNode(state, node.id, { ...victory, victory: false });
    expect(defeated.status).toBe("defeat");
    expect(
      completeExpeditionNode(state, node.id, {
        ...victory,
        robotHp: { robot_rivet: 0, robot_anchor: 0, robot_gale: 0 },
      }).status,
    ).toBe("defeat");
    expect(() => completeExpeditionNode(defeated, node.id, victory)).toThrow("not active");
  });
});
