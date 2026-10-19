-- CreateEnum
CREATE TYPE "PatientFormStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationTemplate" ADD VALUE 'PATIENT_FORM_LINK';

-- AlterTable
ALTER TABLE "StaffNotification" ADD COLUMN     "link" TEXT;

-- CreateTable
CREATE TABLE "PatientFormRequest" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "PatientFormStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "answers" JSONB,
    "signatureName" TEXT,
    "consentAt" TIMESTAMP(3),
    "ipHash" TEXT,

    CONSTRAINT "PatientFormRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientFormRequest_tokenHash_key" ON "PatientFormRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "PatientFormRequest_patientId_createdAt_idx" ON "PatientFormRequest"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "PatientFormRequest_clinicId_status_idx" ON "PatientFormRequest"("clinicId", "status");

-- AddForeignKey
ALTER TABLE "PatientFormRequest" ADD CONSTRAINT "PatientFormRequest_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFormRequest" ADD CONSTRAINT "PatientFormRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFormRequest" ADD CONSTRAINT "PatientFormRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
