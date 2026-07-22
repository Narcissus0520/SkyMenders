import { describe, expect, it } from "vitest";

import { AI_DIFFICULTY_PROFILES, ENEMY_DEFINITIONS, scoreAiCandidate } from "../src/index.js";
import type { AiCandidateSeed, AiGoal } from "../src/index.js";
import { aiFixture } from "./fixtures.js";

describe("nine-dimensional utility scoring", () => {
  it("rewards hostile control and objective work while charging energy", () => {
    const fixture = aiFixture([{ prototypeId: "enemy_magnet" }], "hard");
    const actor = enemy(fixture.battle);
    const player = fixture.battle.actors.find((candidate) => candidate.id === "player:1");
    if (player === undefined) throw new Error("player fixture missing");
    const scored = score(
      fixture,
      actor,
      "control_field",
      candidate({
        kind: "use_module",
        commandId: "score:magnet",
        battleId: fixture.battle.battleId,
        turnIndex: fixture.battle.turnIndex,
        actorId: actor.id,
        moduleId: "main_magnetic_anchor",
        originX: actor.x,
        originY: actor.y,
        angleMilliDegrees: 180_000,
        powerPermille: 700,
        targetId: player.id,
        targetX: player.x,
        targetY: player.y,
      }),
    );
    expect(scored.utility.expectedDamage).toBe(105);
    expect(scored.utility.controlBenefit).toBe(85);
    expect(scored.utility.energyCost).toBeGreaterThan(0);
    expect(scored.utility.friendlyFireRisk).toBe(0);
  });

  it("penalizes friendly fire, unsafe drilling, exposure, and waiting", () => {
    const fixture = aiFixture(
      [{ prototypeId: "enemy_driller" }, { prototypeId: "enemy_guard" }],
      "expert",
    );
    const actor = enemy(fixture.battle);
    const ally = fixture.battle.actors.find((candidate) => candidate.id === "enemy:2");
    if (ally === undefined) throw new Error("ally fixture missing");
    const friendlyPush = score(
      fixture,
      actor,
      "pressure_target",
      candidate({
        kind: "use_basic_action",
        commandId: "score:push",
        battleId: fixture.battle.battleId,
        turnIndex: fixture.battle.turnIndex,
        actorId: actor.id,
        action: "push",
        targetId: ally.id,
      }),
    );
    expect(friendlyPush.utility.friendlyFireRisk).toBe(110);

    const drill = score(
      fixture,
      actor,
      "disrupt_support",
      candidate({
        kind: "use_module",
        commandId: "score:drill",
        battleId: fixture.battle.battleId,
        turnIndex: fixture.battle.turnIndex,
        actorId: actor.id,
        moduleId: "main_drill_bee",
        originX: actor.x,
        originY: actor.y,
        angleMilliDegrees: 270_000,
        powerPermille: 700,
        targetX: actor.x,
        targetY: 0,
      }),
    );
    expect(drill.utility.terrainBenefit).toBe(95);
    expect(drill.utility.fallRisk).toBeGreaterThan(0);

    const wait = score(
      fixture,
      actor,
      "wait",
      candidate({
        kind: "wait",
        commandId: "score:wait",
        battleId: fixture.battle.battleId,
        turnIndex: fixture.battle.turnIndex,
        actorId: actor.id,
      }),
    );
    expect(wait.weightedScore).toBeLessThan(drill.weightedScore);
  });

  it("values repair and movement according to safety and task goals", () => {
    const fixture = aiFixture([{ prototypeId: "enemy_repairer" }], "normal");
    const original = enemy(fixture.battle);
    const actor = { ...original, hp: Math.trunc(original.maxHp / 2) };
    const repair = score(
      fixture,
      actor,
      "recover",
      candidate({
        kind: "use_basic_action",
        commandId: "score:repair",
        battleId: fixture.battle.battleId,
        turnIndex: fixture.battle.turnIndex,
        actorId: actor.id,
        action: "repair",
        targetId: actor.id,
      }),
    );
    expect(repair.utility.selfSafety).toBeGreaterThan(0);

    const move = score(
      fixture,
      actor,
      "secure_objective",
      candidate({
        kind: "move",
        commandId: "score:move",
        battleId: fixture.battle.battleId,
        turnIndex: fixture.battle.turnIndex,
        actorId: actor.id,
        destinationX: actor.x - 3,
        destinationY: actor.y,
      }),
    );
    expect(move.utility.taskBenefit).toBeGreaterThan(0);
  });
});

function score(
  fixture: ReturnType<typeof aiFixture>,
  actor: ReturnType<typeof enemy>,
  goal: AiGoal,
  seed: AiCandidateSeed,
) {
  return scoreAiCandidate({
    battle: fixture.battle,
    actor,
    candidate: seed,
    goal,
    weights: ENEMY_DEFINITIONS.enemy_driller.utilityWeights,
    difficulty: AI_DIFFICULTY_PROFILES[fixture.ai.difficulty],
    preferredModules: [],
  });
}

function candidate(command: AiCandidateSeed["command"]): AiCandidateSeed {
  return { candidateId: `candidate:${command.commandId}`, goal: "pressure_target", command };
}

function enemy(battle: ReturnType<typeof aiFixture>["battle"]) {
  const actor = battle.actors.find((candidate) => candidate.team === "enemy");
  if (actor === undefined) throw new Error("enemy fixture missing");
  return actor;
}
