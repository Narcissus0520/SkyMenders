import { describe, expect, it } from "vitest";

import {
  createHistory,
  isDirty,
  markSaved,
  pushHistory,
  redoHistory,
  undoHistory,
} from "../src/history.js";

describe("content edit history", () => {
  it("tracks dirty state and deterministic undo/redo", () => {
    const initial = createHistory({ value: 1 });
    const edited = pushHistory(initial, { value: 2 });
    expect(isDirty(edited)).toBe(true);
    expect(undoHistory(edited).present).toEqual({ value: 1 });
    expect(redoHistory(undoHistory(edited)).present).toEqual({ value: 2 });
    expect(isDirty(markSaved(edited))).toBe(false);
  });

  it("bounds retained edit history", () => {
    let history = createHistory(0);
    for (let value = 1; value <= 60; value += 1) history = pushHistory(history, value, 10);
    expect(history.past).toHaveLength(10);
    expect(history.present).toBe(60);
  });
});
