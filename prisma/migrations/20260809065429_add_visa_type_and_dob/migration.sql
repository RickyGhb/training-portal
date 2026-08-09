-- CreateEnum
CREATE TYPE "VisaType" AS ENUM ('CPT', 'INITIAL_OPT', 'STEM_OPT', 'H1B', 'H4EAD', 'GC', 'US_CITIZEN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "visaType" "VisaType";
