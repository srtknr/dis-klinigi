/*
  Warnings:

  - You are about to drop the column `communicationConsent` on the `Appointment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "communicationConsent",
ADD COLUMN     "explicitConsentAt" TIMESTAMP(3);
