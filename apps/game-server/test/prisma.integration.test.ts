import { describe, expect, it } from "vitest";

import { PrismaGameRepository } from "../src/infrastructure/prisma.repository.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.runIf(databaseUrl !== undefined)("Prisma account persistence", () => {
  it("persists pseudonymous accounts and cascades a hard deletion", async () => {
    if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
    const repository = new PrismaGameRepository(databaseUrl);
    const now = new Date("2026-07-22T08:00:00.000Z");
    try {
      const subjectHash = `integration-${crypto.randomUUID()}`;
      const first = await repository.findOrCreateAccount("wechat", subjectHash, now);
      const repeated = await repository.findOrCreateAccount("wechat", subjectHash, now);
      expect(repeated.id).toBe(first.id);
      const profile = await repository.getProfile(first.id);
      expect(profile?.accountId).toBe(first.id);
      expect(typeof profile?.systemCode).toBe("string");
      expect(await repository.getProgress(first.id)).toMatchObject({
        logicalClock: 0,
        unlockIds: ["robot_rivet", "robot_anchor", "robot_gale"],
      });

      await repository.createSession({
        id: crypto.randomUUID(),
        accountId: first.id,
        refreshTokenHash: "h".repeat(43),
        deviceKind: "wechat",
        createdAt: now,
        expiresAt: new Date("2026-08-21T08:00:00.000Z"),
        revokedAt: null,
      });
      await repository.createPrivacyRequest({
        requestId: crypto.randomUUID(),
        accountId: first.id,
        kind: "delete",
        status: "processing",
        createdAt: now.toISOString(),
        completedAt: null,
      });
      await repository.hardDeleteAccount(first.id);
      expect(await repository.findAccount(first.id)).toBeNull();
    } finally {
      await repository.close();
    }
  });
});
