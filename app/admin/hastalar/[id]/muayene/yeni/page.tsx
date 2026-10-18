import type { Metadata } from "next";
import { TreatmentForm } from "@/components/admin/treatment-form";
import { PageHeader } from "@/components/shared/page-header";
import { listDentistOptions } from "@/features/dentists/service";
import { getPatientForEdit } from "@/features/patients/service";
import { requirePagePermission } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { loadOrNotFound } from "@/lib/http/load-or-not-found";
import { fullName } from "@/lib/text";
import { dateKeyInTz, formatDateTime, todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Muayene kaydı" };

export default async function NewTreatmentPage({
  params,
  searchParams,
}: PageProps<"/admin/hastalar/[id]/muayene/yeni">) {
  const ctx = await requirePagePermission("TREATMENT_MANAGE");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const patient = await loadOrNotFound(() => getPatientForEdit(ctx, id));
  const [dentists, appointments] = await Promise.all([
    listDentistOptions(ctx),
    db.appointment.findMany({
      where: { clinicId: ctx.clinicId, patientId: patient.id },
      orderBy: { startsAt: "desc" },
      take: 20,
      select: { id: true, startsAt: true, dentistId: true, dentist: { select: { title: true, firstName: true, lastName: true } } },
    }),
  ]);
  const randevu = typeof sp.randevu === "string" ? sp.randevu : "";
  const linked = appointments.find((a) => a.id === randevu);

  return (
    <>
      <PageHeader
        title={`Muayene kaydı — ${fullName(patient.firstName, patient.lastName)}`}
        back={{ href: `/admin/hastalar/${patient.id}`, label: "Hasta kartı" }}
      />
      <TreatmentForm
        patientId={patient.id}
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
        appointments={appointments.map((a) => ({
          id: a.id,
          label: `${formatDateTime(a.startsAt)} · ${a.dentist.title} ${a.dentist.firstName} ${a.dentist.lastName}`,
        }))}
        initial={{
          dentistId: linked?.dentistId ?? ctx.dentistProfileId ?? "",
          appointmentId: randevu,
          visitDate: linked ? dateKeyInTz(linked.startsAt) : todayKey(),
          procedure: "",
          examinationNote: "",
          nextVisitPlan: "",
          nextVisitTodo: "",
        }}
      />
    </>
  );
}
