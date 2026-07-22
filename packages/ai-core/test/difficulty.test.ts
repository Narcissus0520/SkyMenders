import { describe, expect, it } from "vitest";

import { AI_DIFFICULTY_PROFILES, planAiAction } from "../src/index.js";
import { aiFixture } from "./fixtures.js";

describe("difficulty-specific search and aim error", () => {
  it("expands candidate search and narrows deterministic error without stat scaling", () => {
    const normalFixture = aiFixture([{ prototypeId: "enemy_artillery" }], "normal", 991);
    const expertFixture = aiFixture([{ prototypeId: "enemy_artillery" }], "expert", 991);
    const normal = planAiAction(normalFixture.battle, normalFixture.ai, "enemy:1");
    const expert = planAiAction(expertFixture.battle, expertFixture.ai, "enemy:1");
    expect(normal.trace.candidates.length).toBeLessThan(expert.trace.candidates.length);
    expect(Math.abs(normal.trace.angleErrorMilliDegrees)).toBeLessThanOrEqual(
      AI_DIFFICULTY_PROFILES.normal.angleErrorMilliDegrees,
    );
    expect(Math.abs(expert.trace.angleErrorMilliDegrees)).toBeLessThanOrEqual(
      AI_DIFFICULTY_PROFILES.expert.angleErrorMilliDegrees,
    );
    const normalActor = normalFixture.battle.actors.find((actor) => actor.id === "enemy:1");
    const expertActor = expertFixture.battle.actors.find((actor) => actor.id === "enemy:1");
    expect(expertActor?.hp).toBe(normalActor?.hp);
    expect(expertActor?.maxHp).toBe(normalActor?.maxHp);
  });

  it("uses an independent aim-error stream only for module commands", () => {
    const fixture = aiFixture([{ prototypeId: "enemy_scout" }], "hard", 31337);
    const decision = planAiAction(fixture.battle, fixture.ai, "enemy:1");
    if (decision.command.kind === "use_module") {
      expect(decision.state.aimErrorRngState).not.toEqual(fixture.ai.aimErrorRngState);
    } else {
      expect(decision.state.aimErrorRngState).toEqual(fixture.ai.aimErrorRngState);
      expect(decision.trace.angleErrorMilliDegrees).toBe(0);
      expect(decision.trace.powerErrorPermille).toBe(0);
    }
  });
});
