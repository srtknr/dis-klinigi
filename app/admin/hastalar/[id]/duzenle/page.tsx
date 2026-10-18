import type { Metadata } from "next";
import { birthDateKey, PatientForm } from "@/components/admin/patient-form";
import { PageHeader } from "@/components/shared/page-header";
import { getPatientForEdit } from "@/features/patients/service";
import { requirePagePermission } from "@/lib/auth/current";
import { loadOrNotFound } from "@/lib/http/load-or-not-found";
import { formatPhone } from "@/lib/phone";
import { fullName } from "@/lib/text";

export const metadata: Metadata = { title: "Hasta düzenle" };

export default async function EditPatientPage({ params }: PageProps<"/admin/hastalar/[id]/duzenle">) {
  const ctx = await requirePagePermission("PATIENT_MANAGE");
  const { id } = await params;
  const patient = await loadOrNotFound(() => getPatientForEdit(ctx, id));
  return (
    <>
      <PageHeader
        title={`${fullName(patient.firstName, patient.lastName)} — düzenle`}
        back={{ href: `/admin/hastalar/${patient.id}`, label: "Hasta kartı" }}
      />
      <PatientForm
        patientId={patient.id}
        initial={{
          firstName: patient.firstName,
          lastName: patient.lastName,
          phone: formatPhone(patient.phone),
          email: patient.email ?? "",
          birthDate: birthDateKey(patient.birthDate),
        }}
      />
    </>
  );
}
