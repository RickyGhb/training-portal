-- AlterTable
ALTER TABLE "TrainingPath" ADD COLUMN     "technology" TEXT;

-- CreateIndex
CREATE INDEX "TrainingPath_technology_idx" ON "TrainingPath"("technology");
