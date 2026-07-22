import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createDailyChallenge } from "@skymenders/challenge-core";

import { loadChallengeContent } from "../src/infrastructure/challenge-runtime.js";
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
      const challenge = createDailyChallenge(
        loadChallengeContent(resolve(import.meta.dirname, "../../../content")),
        {
          instant: now,
          timeZone: "Asia/Shanghai",
          seedSecret: "postgres-integration-secret-with-thirty-two-bytes",
          rulesVersion: "0.5.0",
          contentVersion: "0.1.0",
        },
      );
      const storedChallenge = await repository.ensureDailyChallenge({
        id: challenge.challengeId,
        definition: challenge,
        createdAt: now,
      });
      const rotatedChallenge = createDailyChallenge(
        loadChallengeContent(resolve(import.meta.dirname, "../../../content")),
        {
          instant: now,
          timeZone: "Asia/Shanghai",
          seedSecret: "rotated-integration-secret-with-thirty-two-bytes",
          rulesVersion: "0.5.0",
          contentVersion: "0.1.0",
        },
      );
      expect(
        (
          await repository.ensureDailyChallenge({
            id: rotatedChallenge.challengeId,
            definition: rotatedChallenge,
            createdAt: now,
          })
        ).id,
      ).toBe(storedChallenge.id);
      const attempts = await Promise.all(
        [1, 2, 3, 3].map((formalSlot) =>
          repository.createFormalAttempt({
            id: crypto.randomUUID(),
            accountId: first.id,
            challengeId: challenge.challengeId,
            mode: "formal",
            formalSlot,
            status: "active",
            checkpointIndex: null,
            checkpoint: null,
            startedAt: now,
            updatedAt: now,
            completedAt: null,
          }),
        ),
      );
      expect(attempts.filter((attempt) => attempt !== null)).toHaveLength(3);
      expect(await repository.countFormalAttempts(first.id, challenge.challengeId)).toBe(3);
      await repository.hardDeleteAccount(first.id);
      expect(await repository.findAccount(first.id)).toBeNull();
    } finally {
      await repository.close();
    }
  });
});
