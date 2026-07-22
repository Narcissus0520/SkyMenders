import { describe, expect, it } from "vitest";

import { reduceBattleCommand } from "@skymenders/battle-core";

import {
  AI_MAX_BOSS_COUNTERS,
  BOSS_DEFINITIONS,
  BOSS_IDS,
  applyBossCounterCommand,
  applyBossCounterSignal,
  bossCounterSignalForCommand,
  findBossRuntime,
  planAiAction,
  replaceBossRuntime,
} from "../src/index.js";
import { aiFixture, playerActionFixture } from "./fixtures.js";

describe("multi-stage boss authority", () => {
  it.each(BOSS_IDS)("completes boss %s through both declared strategies", (bossId) => {
    const definition = BOSS_DEFINITIONS[bossId];
    const histories: string[][] = [];
    for (const [routeIndex, route] of definition.solutionRoutes.entries()) {
      let state = aiFixture([{ bossId }]).ai;
      for (const [signalIndex, signal] of route.entries()) {
        state = applyBossCounterSignal(
          state,
          bossId,
          `counter:${routeIndex}:${signalIndex}`,
          signal,
        ).state;
      }
      const runtime = findBossRuntime(state, bossId);
      expect(runtime.completed).toBe(true);
      expect(runtime.stageHistory).toEqual([
        ...definition.stages.map((stage) => stage.id),
        "complete",
      ]);
      histories.push([...runtime.acceptedCommandIds]);
    }
    expect(histories[0]).not.toEqual(histories[1]);
  });

  it("derives counters only from accepted checkpointed battle commands", () => {
    const fixture = playerActionFixture({ bossId: "boss_rift_drill" });
    const player = fixture.battle.actors.find((actor) => actor.id === "player:1");
    if (player === undefined) throw new Error("player fixture missing");
    const command = {
      kind: "use_module" as const,
      commandId: "cmd:boss-counter",
      battleId: fixture.battle.battleId,
      turnIndex: fixture.battle.turnIndex,
      actorId: player.id,
      moduleId: "main_drill_bee",
      originX: player.x,
      originY: player.y,
      angleMilliDegrees: 270_000,
      powerPermille: 700,
      targetX: player.x,
      targetY: 0,
    };
    const reduction = reduceBattleCommand(fixture.battle, command, 20);
    expect(bossCounterSignalForCommand(command)).toBe("terrain_breached");
    expect(bossCounterSignalForCommand({ ...command, kind: "wait" } as never)).toBeNull();
    const counter = applyBossCounterCommand(
      fixture.ai,
      "boss_rift_drill",
      command,
      reduction.events,
    );
    expect(counter.event).toMatchObject({ kind: "counter_applied", progress: 1 });
    expect(findBossRuntime(counter.state, "boss_rift_drill").stageProgress).toBe(1);
    expect(() => applyBossCounterCommand(fixture.ai, "boss_rift_drill", command, [])).toThrow(
      /accepted/,
    );
  });

  it("ignores irrelevant counters, rejects replay, and bounds the counter log", () => {
    const fixture = aiFixture([{ bossId: "boss_rift_drill" }]);
    const ignored = applyBossCounterSignal(
      fixture.ai,
      "boss_rift_drill",
      "counter:ignored",
      "core_repaired",
    );
    expect(ignored.event.kind).toBe("counter_ignored");
    expect(ignored.state).toBe(fixture.ai);

    const applied = applyBossCounterSignal(
      fixture.ai,
      "boss_rift_drill",
      "counter:one",
      "terrain_breached",
    );
    expect(() =>
      applyBossCounterSignal(applied.state, "boss_rift_drill", "counter:one", "terrain_breached"),
    ).toThrow(/already applied/);

    const runtime = findBossRuntime(fixture.ai, "boss_rift_drill");
    const full = replaceBossRuntime(fixture.ai, {
      ...runtime,
      acceptedCommandIds: Array.from(
        { length: AI_MAX_BOSS_COUNTERS },
        (_, index) => `counter:full:${index}`,
      ),
    });
    expect(() =>
      applyBossCounterSignal(full, "boss_rift_drill", "counter:overflow", "terrain_breached"),
    ).toThrow(/full/);
  });

  it.each(BOSS_IDS)("uses the current stage to override boss %s planning", (bossId) => {
    const fixture = aiFixture([{ bossId }], "expert", 77);
    const decision = planAiAction(fixture.battle, fixture.ai, "enemy:1");
    expect(decision.trace.selectedGoal).toBe(BOSS_DEFINITIONS[bossId].stages[0]?.preferredGoal);
    expect(() => reduceBattleCommand(fixture.battle, decision.command, 0)).not.toThrow();
  });

  it("makes a completed boss inert through the same legal wait command", () => {
    const fixture = aiFixture([{ bossId: "boss_rift_drill" }], "expert", 88);
    let ai = fixture.ai;
    for (const [index, signal] of BOSS_DEFINITIONS.boss_rift_drill.solutionRoutes[0].entries()) {
      ai = applyBossCounterSignal(ai, "boss_rift_drill", `counter:complete:${index}`, signal).state;
    }
    const decision = planAiAction(fixture.battle, ai, "enemy:1");
    expect(decision.command.kind).toBe("wait");
    expect(decision.trace.selectedGoal).toBe("wait");
  });
});
