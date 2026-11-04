-- ============================================================================
-- Agency Ops: all pending DB changes, in one file.
-- Run once on STAGING, check the app, then run the same file on PRODUCTION.
--
-- Every statement is safe to re-run (IF NOT EXISTS / guarded UPDATE), so running
-- it twice, or on a DB that already has some of these changes, is a no-op.
-- Whole file runs in one transaction: if any statement fails, nothing is applied.
--
-- Run with:  psql "$DATABASE_URL" -f scripts/sql/release-db-changes.sql
-- (or paste into the Neon SQL editor)
-- ============================================================================

BEGIN;

-- ─── 1. Employee profile fields on TeamMember (2026-11-03) ──────────────────
-- birthday already exists on production (added 2026-10-07); included so a
-- staging DB that is behind gets it too.
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "birthday"    TIMESTAMP(3);
-- Job title shown on the profile (separate from the system access role)
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "designation" TEXT;
-- Joining date / work anniversary (app falls back to createdAt when NULL)
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "joiningDate" TIMESTAMP(3);

-- ─── 2. Daily task types: General "Admin" -> "Research" (2026-11-02) ────────
-- Renames the row in place so every role that had Admin now gets Research.
-- Old tasks saved as 'admin' are untouched and still display as "Admin".
UPDATE "DailyTaskTypeOption"
SET "value" = 'general_research', "label" = 'Research'
WHERE "value" = 'admin' AND "groupLabel" = 'General'
  AND NOT EXISTS (SELECT 1 FROM "DailyTaskTypeOption" WHERE "value" = 'general_research');

-- ─── 3. Celebration email log (birthday emails) (2026-11-03) ─────────────────
-- One row per birthday / work-anniversary email sent, so the daily cron never
-- sends the same greeting twice. Matches prisma model CelebrationEmailLog.
CREATE TABLE IF NOT EXISTS "CelebrationEmailLog" (
    "id"             TEXT         NOT NULL,
    "kind"           TEXT         NOT NULL,
    "memberId"       TEXT         NOT NULL,
    "dateKey"        TEXT         NOT NULL,
    "recipientCount" INTEGER      NOT NULL,
    "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CelebrationEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CelebrationEmailLog_kind_memberId_dateKey_key"
    ON "CelebrationEmailLog"("kind", "memberId", "dateKey");

CREATE INDEX IF NOT EXISTS "CelebrationEmailLog_memberId_idx"
    ON "CelebrationEmailLog"("memberId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CelebrationEmailLog_memberId_fkey'
    ) THEN
        ALTER TABLE "CelebrationEmailLog"
            ADD CONSTRAINT "CelebrationEmailLog_memberId_fkey"
            FOREIGN KEY ("memberId") REFERENCES "TeamMember"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ─── 4. Employee documents (2026-11-04) ──────────────────────────────────────
-- Metadata for employee-uploaded documents (files live in a private Vercel
-- Blob store). Matches prisma model EmployeeDocument.
CREATE TABLE IF NOT EXISTS "EmployeeDocument" (
    "id"           TEXT         NOT NULL,
    "memberId"     TEXT         NOT NULL,
    "type"         TEXT         NOT NULL,
    "label"        TEXT,
    "fileName"     TEXT         NOT NULL,
    "blobPathname" TEXT         NOT NULL,
    "blobUrl"      TEXT         NOT NULL,
    "mimeType"     TEXT         NOT NULL,
    "size"         INTEGER      NOT NULL,
    "uploadedById" TEXT         NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmployeeDocument_memberId_type_idx"
    ON "EmployeeDocument"("memberId", "type");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeDocument_memberId_fkey'
    ) THEN
        ALTER TABLE "EmployeeDocument"
            ADD CONSTRAINT "EmployeeDocument_memberId_fkey"
            FOREIGN KEY ("memberId") REFERENCES "TeamMember"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeDocument_uploadedById_fkey'
    ) THEN
        ALTER TABLE "EmployeeDocument"
            ADD CONSTRAINT "EmployeeDocument_uploadedById_fkey"
            FOREIGN KEY ("uploadedById") REFERENCES "TeamMember"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

COMMIT;

-- ─── OPTIONAL (run separately, only if you want it) ─────────────────────────
-- Fill joiningDate from the account creation date for existing members.
-- Skip if you'd rather enter real joining dates by hand.
--
-- UPDATE "TeamMember" SET "joiningDate" = "createdAt" WHERE "joiningDate" IS NULL;

-- Add new DB changes above COMMIT as features land.
