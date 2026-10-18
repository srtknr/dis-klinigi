import type { Metadata } from "next";
import { PatientForm } from "@/components/admin/patient-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Hasta ekle" };

export default async function NewPatientPage() {
  await requirePagePermission("PATIENT_MANAGE");
  return (
    <>
      <PageHeader title="Hasta ekle" back={{ href: "/admin/hastalar", label: "Hastalar" }} />
      <PatientForm initial={{ firstName: "", lastName: "", phone: "", email: "", birthDate: "" }} />
    </>
  );
}
