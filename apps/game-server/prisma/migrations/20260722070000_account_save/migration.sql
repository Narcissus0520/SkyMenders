CREATE TABLE "accounts" (
  "id" UUID PRIMARY KEY,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "platform_subjects" (
  "id" UUID PRIMARY KEY,
  "accountId" UUID NOT NULL UNIQUE REFERENCES "accounts"("id") ON DELETE CASCADE,
  "platform" TEXT NOT NULL,
  "subjectHash" VARCHAR(64) NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "platform_subjects_platform_subjectHash_idx" ON "platform_subjects"("platform", "subjectHash");

CREATE TABLE "sessions" (
  "id" UUID PRIMARY KEY,
  "accountId" UUID NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "refreshTokenHash" VARCHAR(64) NOT NULL UNIQUE,
  "deviceKind" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3)
);
CREATE INDEX "sessions_accountId_expiresAt_idx" ON "sessions"("accountId", "expiresAt");

CREATE TABLE "profiles" (
  "accountId" UUID PRIMARY KEY REFERENCES "accounts"("id") ON DELETE CASCADE,
  "systemCode" VARCHAR(64) NOT NULL UNIQUE,
  "settings" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "account_progress" (
  "accountId" UUID PRIMARY KEY REFERENCES "accounts"("id") ON DELETE CASCADE,
  "logicalClock" INTEGER NOT NULL CHECK ("logicalClock" >= 0),
  "document" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);

CREATE TABLE "unlocks" (
  "accountId" UUID NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "unlockId" VARCHAR(96) NOT NULL,
  "unlockedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("accountId", "unlockId")
);

CREATE TABLE "achievements" (
  "accountId" UUID NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "achievementId" VARCHAR(96) NOT NULL,
  "unlockedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("accountId", "achievementId")
);

CREATE TABLE "expedition_saves" (
  "accountId" UUID PRIMARY KEY REFERENCES "accounts"("id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL CHECK ("revision" >= 0),
  "logicalClock" INTEGER NOT NULL CHECK ("logicalClock" >= 0),
  "document" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);

CREATE TABLE "save_recovery" (
  "id" UUID PRIMARY KEY,
  "accountId" UUID NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "kind" VARCHAR(32) NOT NULL,
  "document" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "save_recovery_accountId_expiresAt_idx" ON "save_recovery"("accountId", "expiresAt");

CREATE TABLE "privacy_requests" (
  "id" UUID PRIMARY KEY,
  "accountId" UUID REFERENCES "accounts"("id") ON DELETE SET NULL,
  "kind" VARCHAR(16) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3)
);
CREATE INDEX "privacy_requests_accountId_createdAt_idx" ON "privacy_requests"("accountId", "createdAt");

CREATE TABLE "idempotency_records" (
  "id" UUID PRIMARY KEY,
  "accountId" UUID NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "route" VARCHAR(128) NOT NULL,
  "key" VARCHAR(128) NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  UNIQUE ("accountId", "route", "key")
);
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");
