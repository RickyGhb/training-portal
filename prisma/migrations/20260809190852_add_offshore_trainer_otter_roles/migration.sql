-- CreateEnum
CREATE TYPE "MarketingStatus" AS ENUM ('IN_TRAINING', 'IN_MARKETING');

-- CreateEnum
CREATE TYPE "FeedbackVerdict" AS ENUM ('READY', 'NOT_READY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActionType" ADD VALUE 'TRAINER_FEEDBACK_SUBMITTED';
ALTER TYPE "AuditActionType" ADD VALUE 'OTTER_FEEDBACK_SUBMITTED';
ALTER TYPE "AuditActionType" ADD VALUE 'MARKETING_STATUS_CHANGED';
ALTER TYPE "AuditActionType" ADD VALUE 'TEAM_LEAD_REASSIGNED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MARKETING_READY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'OFFSHORE_MANAGER';
ALTER TYPE "Role" ADD VALUE 'OFFSHORE_TEAM_LEAD';
ALTER TYPE "Role" ADD VALUE 'TRAINER';
ALTER TYPE "Role" ADD VALUE 'OTTER_TEAM';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calendlyLink" TEXT,
ADD COLUMN     "marketingStatus" "MarketingStatus" NOT NULL DEFAULT 'IN_TRAINING',
ADD COLUMN     "offshoreTeamLeadId" TEXT,
ADD COLUMN     "otterTeamUserId" TEXT,
ADD COLUMN     "trainerUserId" TEXT;

-- CreateTable
CREATE TABLE "TrainerFeedback" (
    "id" TEXT NOT NULL,
    "consultantUserId" TEXT NOT NULL,
    "trainerUserId" TEXT NOT NULL,
    "verdict" "FeedbackVerdict" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtterFeedback" (
    "id" TEXT NOT NULL,
    "consultantUserId" TEXT NOT NULL,
    "otterUserId" TEXT NOT NULL,
    "verdict" "FeedbackVerdict" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtterFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainerFeedback_consultantUserId_idx" ON "TrainerFeedback"("consultantUserId");

-- CreateIndex
CREATE INDEX "TrainerFeedback_trainerUserId_idx" ON "TrainerFeedback"("trainerUserId");

-- CreateIndex
CREATE INDEX "OtterFeedback_consultantUserId_idx" ON "OtterFeedback"("consultantUserId");

-- CreateIndex
CREATE INDEX "OtterFeedback_otterUserId_idx" ON "OtterFeedback"("otterUserId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_offshoreTeamLeadId_fkey" FOREIGN KEY ("offshoreTeamLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_trainerUserId_fkey" FOREIGN KEY ("trainerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_otterTeamUserId_fkey" FOREIGN KEY ("otterTeamUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerFeedback" ADD CONSTRAINT "TrainerFeedback_consultantUserId_fkey" FOREIGN KEY ("consultantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerFeedback" ADD CONSTRAINT "TrainerFeedback_trainerUserId_fkey" FOREIGN KEY ("trainerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtterFeedback" ADD CONSTRAINT "OtterFeedback_consultantUserId_fkey" FOREIGN KEY ("consultantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtterFeedback" ADD CONSTRAINT "OtterFeedback_otterUserId_fkey" FOREIGN KEY ("otterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
