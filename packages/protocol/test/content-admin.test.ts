import { describe, expect, it } from "vitest";

import {
  adminSessionRequestSchema,
  announcementRequestSchema,
  confirmedAdminActionSchema,
  riskSwitchRequestSchema,
} from "../src/index.js";

describe("admin protocol", () => {
  it("requires a distinct short-lived admin bootstrap exchange", () => {
    expect(
      adminSessionRequestSchema.parse({
        adminCode: "release.operator",
        bootstrapToken: "x".repeat(32),
      }),
    ).toMatchObject({ adminCode: "release.operator" });
    expect(() =>
      adminSessionRequestSchema.parse({ adminCode: "x", bootstrapToken: "short" }),
    ).toThrow();
  });

  it("requires reasons and typed confirmations for risky writes", () => {
    expect(() =>
      confirmedAdminActionSchema.parse({ reason: "too short", confirmation: "YES" }),
    ).toThrow();
    expect(
      riskSwitchRequestSchema.parse({
        enabled: true,
        reason: "Incident response test",
        confirmation: "UPDATE RISK SWITCH",
      }).enabled,
    ).toBe(true);
    expect(() =>
      announcementRequestSchema.parse({
        titleKey: "notice.title",
        bodyKey: "notice.body",
        startsAt: "2026-07-23T10:00:00.000Z",
        endsAt: "2026-07-23T09:00:00.000Z",
        reason: "Scheduled release notice",
        confirmation: "CREATE ANNOUNCEMENT",
      }),
    ).toThrow();
  });
});
