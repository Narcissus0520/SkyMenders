CREATE TABLE "admin_users" (
  "id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "role" VARCHAR(32) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_sessions" (
  "id" UUID NOT NULL,
  "adminId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3),
  CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_versions" (
  "id" VARCHAR(64) NOT NULL,
  "contentVersion" VARCHAR(32) NOT NULL,
  "artifactHash" VARCHAR(64) NOT NULL,
  "state" VARCHAR(24) NOT NULL,
  "manifest" JSONB NOT NULL,
  "createdBy" UUID NOT NULL,
  "approvedBy" UUID,
  "signature" VARCHAR(64),
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_audit_logs" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "action" VARCHAR(96) NOT NULL,
  "targetType" VARCHAR(64) NOT NULL,
  "targetId" VARCHAR(160) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "previousHash" VARCHAR(64),
  "entryHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_announcements" (
  "id" UUID NOT NULL,
  "titleKey" VARCHAR(160) NOT NULL,
  "bodyKey" VARCHAR(160) NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admin_announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_risk_switches" (
  "key" VARCHAR(64) NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "updatedBy" UUID NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admin_risk_switches_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "admin_operational_actions" (
  "id" UUID NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "targetId" VARCHAR(160) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actorId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admin_operational_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_users_code_key" ON "admin_users"("code");
CREATE INDEX "admin_sessions_adminId_expiresAt_idx" ON "admin_sessions"("adminId", "expiresAt");
CREATE UNIQUE INDEX "content_versions_artifactHash_key" ON "content_versions"("artifactHash");
CREATE INDEX "content_versions_contentVersion_state_idx" ON "content_versions"("contentVersion", "state");
CREATE UNIQUE INDEX "admin_audit_logs_entryHash_key" ON "admin_audit_logs"("entryHash");
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt" DESC);
CREATE INDEX "admin_audit_logs_actorId_createdAt_idx" ON "admin_audit_logs"("actorId", "createdAt" DESC);
CREATE INDEX "admin_announcements_startsAt_endsAt_idx" ON "admin_announcements"("startsAt", "endsAt");
CREATE INDEX "admin_operational_actions_kind_createdAt_idx" ON "admin_operational_actions"("kind", "createdAt" DESC);

ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
