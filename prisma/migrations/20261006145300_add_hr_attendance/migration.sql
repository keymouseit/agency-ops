-- HR Attendance: ScreenshotMonitor mapping on TeamMember + persisted day adjustments.
-- Apply with: npx prisma db push
-- (This repo historically uses db push rather than migrate deploy.)

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "ssmEmploymentId" INTEGER;
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "attendanceEmpNo" INTEGER;
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "attendanceExcluded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "attendanceFixedStart" TEXT;
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "attendanceFixedEnd" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AttendanceAdjustment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "grossHours" TEXT,
    "leaveHours" TEXT,
    "ebh" TEXT,
    "note" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceAdjustment_memberId_date_key" ON "AttendanceAdjustment"("memberId", "date");
CREATE INDEX IF NOT EXISTS "AttendanceAdjustment_date_idx" ON "AttendanceAdjustment"("date");
CREATE INDEX IF NOT EXISTS "AttendanceAdjustment_memberId_date_idx" ON "AttendanceAdjustment"("memberId", "date");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
