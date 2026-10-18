import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TreatmentForm } from "@/components/admin/treatment-form";
import { PageHeader } from "@/components/shared/page-header";
import { listDentistOptions } from "@/features/dentists/service";
import { getTreatmentRecordForEdit } from "@/features/treatments/service";
import { requirePagePermission } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { loadOrNotFound } from "@/lib/http/load-or-not-found";
import { dateOnlyToKey, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Muayene kaydı düzelt" };

export default async function EditTreatmentPage({ params }: PageProps<"/admin/hastalar/[id]/muayene/[recordId]">) {
  const ctx = await requirePagePermission("TREATMENT_MANAGE");
  const { id, recordId } = await params;
  const record = await loadOrNotFound(() => getTreatmentRecordForEdit(ctx, recordId));
  if (record.patientId !== id) notFound();
  const [dentists, appointments] = await Promise.all([
    listDentistOptions(ctx),
    db.appointment.findMany({
      where: { clinicId: ctx.clinicId, patientId: record.patientId },
      orderBy: { startsAt: "desc" },
      take: 20,
      select: { id: true, startsAt: true, dentist: { select: { title: true, firstName: true, lastName: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={`Düzelt: ${record.procedure}`}
        back={{ href: `/admin/hastalar/${record.patientId}`, label: "Hasta kartı" }}
        description={`${record.patient.firstName} ${record.patient.lastName}`}
      />
      <TreatmentForm
        patientId={record.patientId}
        recordId={record.id}
        canVoid={ctx.role === "OWNER"}
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
        appointments={appointments.map((a) => ({
          id: a.id,
          label: `${formatDateTime(a.startsAt)} · ${a.dentist.title} ${a.dentist.firstName} ${a.dentist.lastName}`,
        }))}
        initial={{
          dentistId: record.dentistId,
          appointmentId: record.appointmentId ?? "",
          visitDate: dateOnlyToKey(record.visitDate),
          procedure: record.procedure,
          examinationNote: record.examinationNote ?? "",
          nextVisitPlan: record.nextVisitPlan ?? "",
          nextVisitTodo: record.nextVisitTodo ?? "",
        }}
      />
    </>
  );
}
