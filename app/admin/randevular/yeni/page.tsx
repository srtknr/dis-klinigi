import type { Metadata } from "next";
import { AppointmentCreateForm } from "@/components/admin/appointment-create-form";
import { PageHeader } from "@/components/shared/page-header";
import { listServiceOptions } from "@/features/clinic/service";
import { listDentistOptions } from "@/features/dentists/service";
import { requirePagePermission } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Yeni Randevu" };

export default async function NewAppointmentPage({ searchParams }: PageProps<"/admin/randevular/yeni">) {
  const ctx = await requirePagePermission("APPOINTMENT_CREATE");
  const sp = await searchParams;
  const [dentists, services] = await Promise.all([listDentistOptions(ctx), listServiceOptions(ctx)]);
  const canSearchPatients = can(ctx, "PATIENT_VIEW");

  const patientId = typeof sp.hasta === "string" ? sp.hasta : null;
  const initialPatient =
    patientId && canSearchPatients
      ? await db.patient.findFirst({
          where: { id: patientId, clinicId: ctx.clinicId },
          select: { id: true, firstName: true, lastName: true, phone: true },
        })
      : null;

  return (
    <>
      <PageHeader title="Yeni randevu" back={{ href: "/admin/randevular", label: "Randevular" }} />
      <AppointmentCreateForm
        dentists={dentists.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name, slotMinutes: d.slotMinutes }))}
        services={services}
        canConfirm={can(ctx, "APPOINTMENT_APPROVE")}
        canSearchPatients={canSearchPatients}
        canCreatePatient={can(ctx, "PATIENT_MANAGE")}
        initialPatient={
          initialPatient
            ? { id: initialPatient.id, name: `${initialPatient.firstName} ${initialPatient.lastName}`, phone: initialPatient.phone }
            : null
        }
        todayKey={todayKey()}
      />
    </>
  );
}
