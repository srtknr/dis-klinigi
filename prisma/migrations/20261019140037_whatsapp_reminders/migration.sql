-- CreateEnum
CREATE TYPE "AttendanceResponse" AS ENUM ('YES', 'NO');

-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';

-- AlterEnum
ALTER TYPE "NotificationTemplate" ADD VALUE 'PATIENT_REMINDER_24H';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "attendanceRespondedAt" TIMESTAMP(3),
ADD COLUMN     "attendanceResponse" "AttendanceResponse";

-- CreateTable
CREATE TABLE "ClinicWhatsappConfig" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateLanguage" TEXT NOT NULL DEFAULT 'tr',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicWhatsappConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicWhatsappConfig_clinicId_key" ON "ClinicWhatsappConfig"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicWhatsappConfig_phoneNumberId_key" ON "ClinicWhatsappConfig"("phoneNumberId");

-- CreateIndex
CREATE INDEX "StaffNotification_userId_readAt_createdAt_idx" ON "StaffNotification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_appointmentId_idx" ON "StaffNotification"("appointmentId");

-- AddForeignKey
ALTER TABLE "ClinicWhatsappConfig" ADD CONSTRAINT "ClinicWhatsappConfig_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
