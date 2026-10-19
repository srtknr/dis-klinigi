import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, FilePen, Mail, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientFormsCard } from "@/components/admin/patient-forms-card";
import { PatientNoteForm } from "@/components/admin/patient-note-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { AppointmentStatusBadge, ToneBadge } from "@/components/shared/status-badge";
import { listPatientForms } from "@/features/forms/service";
import { getPatientDetail } from "@/features/patients/service";
import { requirePagePermission } from "@/lib/auth/current";
import { loadOrNotFound } from "@/lib/http/load-or-not-found";
import { can } from "@/lib/permissions";
import { formatPhone, isTrMobile, normalizeTrPhone } from "@/lib/phone";
import { dentistName, fullName } from "@/lib/text";
import { formatDate, formatDateOnly, formatDateTime, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Hasta kartı" };

export default async function PatientDetailPage({ params }: PageProps<"/admin/hastalar/[id]">) {
  const ctx = await requirePagePermission("PATIENT_VIEW");
  const { id } = await params;
  const { patient, upcoming, past, treatments } = await loadOrNotFound(() => getPatientDetail(ctx, id));
  const name = fullName(patient.firstName, patient.lastName);
  const forms = can(ctx, "TREATMENT_VIEW") ? await listPatientForms(ctx, patient.id) : null;
  const mobile = normalizeTrPhone(patient.phone);

  return (
    <>
      <PageHeader
        title={name}
        back={{ href: "/admin/hastalar", label: "Hastalar" }}
        description={formatPhone(patient.phone)}
        actions={
          <>
            {can(ctx, "APPOINTMENT_CREATE") ? (
              <Button asChild variant="outline">
                <Link href={`/admin/randevular/yeni?hasta=${patient.id}`}>
                  <CalendarPlus aria-hidden /> Randevu
                </Link>
              </Button>
            ) : null}
            {can(ctx, "TREATMENT_MANAGE") ? (
              <Button asChild variant="outline">
                <Link href={`/admin/hastalar/${patient.id}/muayene/yeni`}>
                  <Plus aria-hidden /> Muayene notu
                </Link>
              </Button>
            ) : null}
            {can(ctx, "PATIENT_MANAGE") ? (
              <Button asChild>
                <Link href={`/admin/hastalar/${patient.id}/duzenle`}>
                  <FilePen aria-hidden /> Düzenle
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>İletişim</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" aria-hidden />
                <a href={`tel:${patient.phone}`} className="hover:underline">
                  {formatPhone(patient.phone)}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" aria-hidden />
                {patient.email ? (
                  <a href={`mailto:${patient.email}`} className="hover:underline">
                    {patient.email}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p>Doğum tarihi: {patient.birthDate ? formatDateOnly(patient.birthDate) : "—"}</p>
              <p className="text-muted-foreground">Kayıt: {formatDate(patient.createdAt)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Yaklaşan randevular</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Yaklaşan randevu yok.</p>
              ) : (
                <AppointmentList items={upcoming} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Geçmiş randevular</CardTitle>
            </CardHeader>
            <CardContent>
              {past.length === 0 ? (
                <p className="text-sm text-muted-foreground">Geçmiş randevu yok.</p>
              ) : (
                <AppointmentList items={past} />
              )}
            </CardContent>
          </Card>

          {forms ? (
            <PatientFormsCard
              patientId={patient.id}
              canManage={can(ctx, "TREATMENT_MANAGE")}
              canSms={mobile !== null && isTrMobile(mobile)}
              canEmail={Boolean(patient.email)}
              items={forms.map((f) => ({
                id: f.id,
                displayStatus: f.displayStatus,
                createdAt: f.createdAt.toISOString(),
                completedAt: f.completedAt?.toISOString() ?? null,
                createdByName: f.createdBy?.name ?? null,
              }))}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Muayene geçmişi</CardTitle>
            </CardHeader>
            <CardContent>
              {treatments === null ? (
                <p className="text-sm text-muted-foreground">Muayene notlarını görüntüleme yetkiniz yok.</p>
              ) : treatments.length === 0 ? (
                <EmptyState title="Muayene kaydı yok" className="py-8" />
              ) : (
                <ol className="space-y-4">
                  {treatments.map((t) => (
                    <li key={t.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{t.procedure}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateOnly(t.visitDate)} · {dentistName(t.dentist)}
                            {t.appointment ? ` · randevu ${formatTime(t.appointment.startsAt)}` : ""}
                          </p>
                        </div>
                        {t.status === "VOIDED" ? (
                          <ToneBadge tone="danger">Geçersiz</ToneBadge>
                        ) : can(ctx, "TREATMENT_MANAGE") ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/admin/hastalar/${patient.id}/muayene/${t.id}`}>Düzelt</Link>
                          </Button>
                        ) : null}
                      </div>
                      {t.status === "ACTIVE" ? (
                        <div className="mt-3 space-y-2 text-sm">
                          {t.examinationNote ? <p className="whitespace-pre-wrap">{t.examinationNote}</p> : null}
                          {t.nextVisitPlan ? <p className="text-muted-foreground">Sonraki ziyaret: {t.nextVisitPlan}</p> : null}
                          {t.nextVisitTodo ? <p className="text-muted-foreground">Yapılacaklar: {t.nextVisitTodo}</p> : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Bu kayıt geçersiz kılınmıştır; içerik gizlendi.</p>
                      )}
                      {t.revisions.length > 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">{t.revisions.length} düzeltme kaydı var.</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dahili notlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {can(ctx, "PATIENT_MANAGE") ? <PatientNoteForm patientId={patient.id} /> : null}
            {patient.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not yok.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {patient.notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.author?.name ?? "Sistem"} · {formatDateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function AppointmentList({
  items,
}: {
  items: { id: string; startsAt: Date; status: Parameters<typeof AppointmentStatusBadge>[0]["status"]; dentist: { title: string; firstName: string; lastName: string }; service: { name: string } | null }[];
}) {
  return (
    <ul className="divide-y">
      {items.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <Link href={`/admin/randevular/${a.id}`} className="min-w-0 hover:underline">
            <span className="font-medium">{formatDate(a.startsAt)} {formatTime(a.startsAt)}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {dentistName(a.dentist)}
              {a.service ? ` · ${a.service.name}` : ""}
            </span>
          </Link>
          <AppointmentStatusBadge status={a.status} />
        </li>
      ))}
    </ul>
  );
}
