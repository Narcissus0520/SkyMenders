CREATE TABLE "daily_challenges" (
  "id" VARCHAR(240) NOT NULL,
  "businessDate" DATE NOT NULL,
  "rulesVersion" VARCHAR(32) NOT NULL,
  "contentVersion" VARCHAR(32) NOT NULL,
  "seed" BIGINT NOT NULL,
  "definition" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "daily_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_attempts" (
  "id" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "challengeId" VARCHAR(240) NOT NULL,
  "mode" VARCHAR(16) NOT NULL,
  "formalSlot" INTEGER,
  "status" VARCHAR(16) NOT NULL,
  "checkpointIndex" INTEGER,
  "checkpoint" JSONB,
  "startedAt" TIMESTAMPTZ(3) NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "completedAt" TIMESTAMPTZ(3),
  CONSTRAINT "daily_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "replay_submissions" (
  "id" UUID NOT NULL,
  "attemptId" UUID NOT NULL,
  "request" JSONB NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "score" INTEGER,
  "totalTurns" INTEGER,
  "rejectionCode" VARCHAR(48),
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "verifiedAt" TIMESTAMPTZ(3),
  CONSTRAINT "replay_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leaderboard_entries" (
  "id" UUID NOT NULL,
  "challengeId" VARCHAR(240) NOT NULL,
  "accountId" UUID NOT NULL,
  "submissionId" UUID NOT NULL,
  "systemCode" VARCHAR(64) NOT NULL,
  "avatarId" VARCHAR(96) NOT NULL,
  "score" INTEGER NOT NULL,
  "completionMs" INTEGER NOT NULL,
  "turns" INTEGER NOT NULL,
  "completionStatus" VARCHAR(16) NOT NULL,
  "verificationStatus" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "replay_risk_events" (
  "id" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "submissionId" UUID NOT NULL,
  "code" VARCHAR(48) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "replay_risk_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_challenges_businessDate_rulesVersion_contentVersion_key" ON "daily_challenges"("businessDate", "rulesVersion", "contentVersion");
CREATE UNIQUE INDEX "daily_attempts_accountId_challengeId_formalSlot_key" ON "daily_attempts"("accountId", "challengeId", "formalSlot");
CREATE INDEX "daily_attempts_accountId_challengeId_status_idx" ON "daily_attempts"("accountId", "challengeId", "status");
CREATE UNIQUE INDEX "replay_submissions_attemptId_key" ON "replay_submissions"("attemptId");
CREATE INDEX "replay_submissions_status_createdAt_idx" ON "replay_submissions"("status", "createdAt");
CREATE UNIQUE INDEX "leaderboard_entries_submissionId_key" ON "leaderboard_entries"("submissionId");
CREATE UNIQUE INDEX "leaderboard_entries_challengeId_accountId_key" ON "leaderboard_entries"("challengeId", "accountId");
CREATE INDEX "leaderboard_entries_challengeId_score_completionMs_turns_createdAt_idx" ON "leaderboard_entries"("challengeId", "score" DESC, "completionMs", "turns", "createdAt");
CREATE UNIQUE INDEX "replay_risk_events_submissionId_key" ON "replay_risk_events"("submissionId");
CREATE INDEX "replay_risk_events_code_createdAt_idx" ON "replay_risk_events"("code", "createdAt");

ALTER TABLE "daily_attempts" ADD CONSTRAINT "daily_attempts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_attempts" ADD CONSTRAINT "daily_attempts_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "daily_challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replay_submissions" ADD CONSTRAINT "replay_submissions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "daily_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "daily_challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "replay_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "replay_risk_events" ADD CONSTRAINT "replay_risk_events_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "replay_risk_events" ADD CONSTRAINT "replay_risk_events_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "replay_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
