import { describe, expect, it } from "vitest";

import { hashCanonical } from "@skymenders/deterministic-runtime";

import { planAiAction } from "../src/index.js";
import { aiFixture } from "./fixtures.js";

describe("golden AI decision", () => {
  it("pins the selected command, utility trace, error stream, and next authority state", () => {
    const fixture = aiFixture(
      [
        { prototypeId: "enemy_driller", eliteTemplateId: "elite_coord_driller" },
        { prototypeId: "enemy_repairer", eliteTemplateId: "elite_emergency_repairer" },
      ],
      "hard",
      0xa17e_2026,
    );
    const first = planAiAction(fixture.battle, fixture.ai, "enemy:1");
    const second = planAiAction(fixture.battle, fixture.ai, "enemy:1");
    expect(second).toEqual(first);
    expect(hashCanonical(first)).toBe("13f36ad335ed11bf");
  });
});
