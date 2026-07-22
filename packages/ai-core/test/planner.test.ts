import { describe, expect, it } from "vitest";

import { reduceBattleCommand } from "@skymenders/battle-core";

import {
  ENEMY_PROTOTYPE_IDS,
  ELITE_TEMPLATE_DEFINITIONS,
  ELITE_TEMPLATE_IDS,
  assertAiBattleBindings,
  createAiDebugView,
  executeAiEnemyPhase,
  planAiAction,
  renderAiDebugText,
} from "../src/index.js";
import { aiFixture } from "./fixtures.js";

describe("legal deterministic AI planning", () => {
  it("returns the same authority-valid command and trace for identical input", () => {
    const fixture = aiFixture([{ prototypeId: "enemy_driller" }], "expert", 1234);
    const first = planAiAction(fixture.battle, fixture.ai, "enemy:1");
    const second = planAiAction(fixture.battle, fixture.ai, "enemy:1");
    expect(second).toEqual(first);
    const reduced = reduceBattleCommand(fixture.battle, first.command, 10);
    expect(reduced.events[0]).toMatchObject({
      kind: "command_accepted",
      actorId: "enemy:1",
    });
    expect(first.state.decisionIndex).toBe(1);
    expect(first.trace.candidates.some((candidate) => !candidate.legal)).toBe(true);
  });

  it.each(ENEMY_PROTOTYPE_IDS)("plans a legal action for prototype %s", (prototypeId) => {
    const fixture = aiFixture([{ prototypeId }], "hard", 55);
    const decision = planAiAction(fixture.battle, fixture.ai, "enemy:1");
    expect(() => reduceBattleCommand(fixture.battle, decision.command, 0)).not.toThrow();
    expect(decision.trace.selectedCandidateId).toMatch(/^candidate:/);
  });

  it("selects role-specific goals and mechanisms for all eight prototypes", () => {
    const expectations = {
      enemy_scout: ["control_field", "main_energy_rail"],
      enemy_guard: ["control_field", "main_bubble_capsule"],
      enemy_artillery: ["pressure_target", "main_energy_rail"],
      enemy_driller: ["disrupt_support", "aux_structure_scanner"],
      enemy_magnet: ["control_field", "main_magnetic_anchor"],
      enemy_repairer: ["control_field", "main_support_frame"],
      enemy_wind: ["control_field", "main_wind_generator"],
      enemy_carrier: ["secure_objective", "move"],
    } as const;
    for (const prototypeId of ENEMY_PROTOTYPE_IDS) {
      const fixture = aiFixture([{ prototypeId }], "expert", 55);
      const decision = planAiAction(fixture.battle, fixture.ai, "enemy:1");
      const expected = expectations[prototypeId];
      expect(decision.trace.selectedGoal).toBe(expected[0]);
      expect(
        decision.command.kind === "use_module" ? decision.command.moduleId : decision.command.kind,
      ).toBe(expected[1]);
    }
  });

  it("applies elite affixes to candidate utility without changing base durability", () => {
    const baseFixture = aiFixture([{ prototypeId: "enemy_scout" }], "expert", 5);
    const eliteFixture = aiFixture(
      [{ prototypeId: "enemy_scout", eliteTemplateId: "elite_stable_scout" }],
      "expert",
      5,
    );
    const base = planAiAction(baseFixture.battle, baseFixture.ai, "enemy:1");
    const elite = planAiAction(eliteFixture.battle, eliteFixture.ai, "enemy:1");
    expect(elite.trace.selectedScore).not.toBe(base.trace.selectedScore);
    expect(eliteFixture.battle.actors.find((actor) => actor.id === "enemy:1")?.hp).toBe(
      baseFixture.battle.actors.find((actor) => actor.id === "enemy:1")?.hp,
    );
  });

  it.each(ELITE_TEMPLATE_IDS)("executes whitelisted elite template %s", (eliteTemplateId) => {
    const prototypeId = ELITE_TEMPLATE_DEFINITIONS[eliteTemplateId].prototypeId;
    const fixture = aiFixture([{ prototypeId, eliteTemplateId }], "hard", 404);
    const decision = planAiAction(fixture.battle, fixture.ai, "enemy:1");
    expect(() => reduceBattleCommand(fixture.battle, decision.command, 0)).not.toThrow();
  });

  it("executes a complete enemy phase through the shared reducer and separate energy pool", () => {
    const fixture = aiFixture(
      ENEMY_PROTOTYPE_IDS.map((prototypeId) => ({ prototypeId })),
      "expert",
      8080,
    );
    const playerEnergy = fixture.battle.energy.current;
    const execution = executeAiEnemyPhase(fixture.battle, fixture.ai, 50);
    expect(execution.commands.length).toBeGreaterThanOrEqual(ENEMY_PROTOTYPE_IDS.length);
    expect(execution.events.filter((event) => event.kind === "command_accepted")).toHaveLength(
      execution.commands.length,
    );
    expect(
      execution.battleState.actors
        .filter((actor) => actor.team === "enemy" && !actor.disabled)
        .every((actor) => actor.actionEnded),
    ).toBe(true);
    expect(execution.battleState.energy.current).toBe(playerEnergy);
    expect(execution.battleState.enemyEnergy.current).toBeLessThanOrEqual(
      fixture.battle.enemyEnergy.current,
    );
    expect(execution.aiState.decisionIndex).toBe(execution.commands.length);
  });

  it("produces a client-neutral debug visualization from the decision trace", () => {
    const fixture = aiFixture([{ prototypeId: "enemy_magnet" }]);
    const decision = planAiAction(fixture.battle, fixture.ai, "enemy:1");
    const view = createAiDebugView(decision.trace);
    expect(view.title).toContain("enemy:1");
    expect(view.candidateRows.some((row) => row.startsWith(">"))).toBe(true);
    expect(view.markers.every((marker) => Number.isSafeInteger(marker.x))).toBe(true);
    expect(renderAiDebugText(decision.trace)).toContain("behavior:");
  });

  it("fails closed on binding, phase, actor, and completed-action mismatches", () => {
    const fixture = aiFixture();
    const wrongLoadout = {
      ...fixture.battle,
      actors: fixture.battle.actors.map((actor) =>
        actor.id === "enemy:1" ? { ...actor, mainModuleId: "main_drill_bee" as const } : actor,
      ),
    };
    expect(() => {
      assertAiBattleBindings(wrongLoadout, fixture.ai);
    }).toThrow(/loadout|unequipped/);
    expect(() =>
      planAiAction({ ...fixture.battle, phase: "player_action" }, fixture.ai, "enemy:1"),
    ).toThrow(/enemy action/);
    expect(() => planAiAction(fixture.battle, fixture.ai, "player:1")).toThrow(/controller|enemy/);
    const ended = {
      ...fixture.battle,
      actors: fixture.battle.actors.map((actor) =>
        actor.id === "enemy:1" ? { ...actor, actionEnded: true } : actor,
      ),
    };
    expect(() => planAiAction(ended, fixture.ai, "enemy:1")).toThrow(/already ended/);
    expect(() => executeAiEnemyPhase(fixture.battle, fixture.ai, -1)).toThrow(/non-negative/);
  });
});
