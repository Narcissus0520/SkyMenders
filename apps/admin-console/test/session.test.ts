import { describe, expect, it } from "vitest";

import { MemoryAdminSession, confirmationFor } from "../src/session.js";

describe("admin browser session", () => {
  it("keeps credentials only in the explicit in-memory vault", () => {
    const session = new MemoryAdminSession();
    expect(session.get()).toBeNull();
    session.set("short-lived-token");
    expect(session.get()).toBe("short-lived-token");
    session.clear();
    expect(session.get()).toBeNull();
  });

  it("builds exact second-confirmation phrases", () => {
    expect(confirmationFor("score_quarantine", "submission-1")).toBe(
      "SCORE_QUARANTINE submission-1",
    );
  });
});
