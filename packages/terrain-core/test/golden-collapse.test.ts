import { hashCanonical } from "@skymenders/deterministic-runtime";
import { describe, expect, it } from "vitest";

import { executeLargeCollapseScenario } from "../benchmark/large-collapse-scenario.js";
import { assertTerrainState } from "../src/index.js";

describe("large terrain collapse golden", () => {
  it("replays a large bridge cut to identical state and events", () => {
    const first = executeLargeCollapseScenario();
    const second = executeLargeCollapseScenario();
    assertTerrainState(first.collapse.state);
    expect(first).toEqual(second);
    expect(first.analysis.scope).toBe("dirty_components");
    expect(first.analysis.inspectedChunks.length).toBeLessThan(6 * 3);
    expect(first.analysis.unstableComponents).toHaveLength(1);
    expect(first.analysis.unstableComponents[0]).toHaveLength(2_200);
    expect(first.execution.checkpoints).toEqual([
      { operationIndex: 0, stateHash: "3c35bec410593720" },
      { operationIndex: 1, stateHash: "bb473002eac7e50e" },
    ]);
    expect(first.collapse.events).toEqual([
      expect.objectContaining({ outcome: "lost", fallDistance: 46 }),
    ]);
    expect(hashCanonical(first.collapse.state)).toBe("bb473002eac7e50e");
    expect(hashCanonical(first.collapse.events)).toBe("5ee339be9f95cdca");
  });
});
