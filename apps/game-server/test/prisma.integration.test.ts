import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createDailyChallenge } from "@skymenders/challenge-core";
import { publishedContentManifestSchema } from "@skymenders/protocol";

import { loadChallengeContent } from "../src/infrastructure/challenge-runtime.js";
import { PrismaAdminRepository } from "../src/infrastructure/prisma-admin.repository.js";
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
          rulesVersion: "0.6.0",
          contentVersion: "0.2.0",
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
          rulesVersion: "0.6.0",
          contentVersion: "0.2.0",
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

describe.runIf(databaseUrl !== undefined)("Prisma admin control-plane persistence", () => {
  it("persists separate admin sessions, content lifecycle, risk controls and audit", async () => {
    if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required");
    const repository = new PrismaAdminRepository(databaseUrl);
    const now = new Date("2026-07-23T03:00:00.000Z");
    const artifactHash = crypto.randomUUID().replaceAll("-", "").padEnd(64, "0");
    try {
      const admin = await repository.ensureBootstrapAdmin(
        `integration-${crypto.randomUUID()}`,
        now,
      );
      const sessionId = crypto.randomUUID();
      await repository.createSession({
        id: sessionId,
        adminId: admin.id,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 900_000),
        revokedAt: null,
      });
      expect((await repository.findSession(sessionId))?.adminId).toBe(admin.id);
      const manifest = publishedContentManifestSchema.parse({
        schemaVersion: "1.0.0",
        contentVersion: "0.2.0",
        rulesVersion: "0.6.0",
        artifactHash,
        commitSha: "integration-commit",
        createdAt: now.toISOString(),
        catalogHashes: { maps: artifactHash },
        counts: { maps: 16 },
        simulation: {
          seedCount: 1,
          passed: 1,
          failedSeeds: [],
          minimumMinutes: 40,
          maximumMinutes: 40,
        },
      });
      const version = await repository.ensureContentVersion({
        id: artifactHash,
        contentVersion: "0.2.0",
        artifactHash,
        manifest,
        actorId: admin.id,
        now,
      });
      expect(version.state).toBe("staged");
      expect(
        (
          await repository.transitionContentVersion(
            artifactHash,
            "staged",
            "approved",
            admin.id,
            now,
          )
        )?.state,
      ).toBe("approved");
      await repository.appendAudit({
        id: crypto.randomUUID(),
        actorId: admin.id,
        action: "integration.approved",
        targetType: "content_version",
        targetId: artifactHash,
        reason: "PostgreSQL integration evidence",
        previousHash: null,
        entryHash: artifactHash,
        createdAt: now.toISOString(),
      });
      expect(
        (await repository.listAudit(10)).some((entry) => entry.entryHash === artifactHash),
      ).toBe(true);
      const risk = await repository.setRiskSwitch({
        key: `integration_${artifactHash.slice(0, 12)}`,
        enabled: true,
        reason: "PostgreSQL integration evidence",
        updatedBy: admin.id,
        updatedAt: now,
      });
      expect(risk.enabled).toBe(true);
    } finally {
      await repository.close();
    }
  });
});
