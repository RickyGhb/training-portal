-- CreateEnum
CREATE TYPE "OffshoreOffice" AS ENUM ('LOCATION_1', 'LOCATION_2');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "offshoreOffice" "OffshoreOffice";
