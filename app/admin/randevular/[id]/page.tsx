import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, FileText, Mail, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentNoteForm } from "@/components/admin/appointment-note-form";
import { AppointmentRescheduleForm } from "@/components/admin/appointment-reschedule-form";
import { AppointmentStatusActions } from "@/components/admin/appointment-status-actions";
import { PageHeader } from "@/components/shared/page-header";
import { AppointmentStatusBadge, AttendanceBadge, ToneBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { getAppointmentDetail } from "@/features/appointments/queries";
import { appointmentPersonName, SOURCE_LABELS } from "@/features/appointments/format";
import { canTransition, HISTORY_EVENT_LABELS } from "@/features/appointments/status";
import { listDentistOptions } from "@/features/dentists/service";
import { requirePagePermission } from "@/lib/auth/current";
import { loadOrNotFound } from "@/lib/http/load-or-not-found";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { dentistName } from "@/lib/text";
import { formatDateTime, formatLongDate, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Randevu detayı" };

const NOTIF_STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" | "muted" | "info" }> = {
  PENDING: { label: "Kuyrukta", tone: "warning" },
  PROCESSING: { label: "Gönderiliyor", tone: "info" },
  SENT: { label: "Gönderildi", tone: "success" },
  FAILED: { label: "Başarısız", tone: "danger" },
  SKIPPED: { label: "Atlandı", tone: "muted" },
};
const NOTIF_TEMPLATE: Record<string, string> = {
  PATIENT_CONFIRMED: "Onay bildirimi",
  PATIENT_REJECTED: "Red bildirimi",
  PATIENT_CANCELLED: "İptal bildirimi",
  PATIENT_RESCHEDULED: "Yeniden planlama",
  PATIENT_REMINDER_24H: "24 saat hatırlatma",
  ADMIN_NEW_REQUEST: "Yeni talep (klinik)",
};
const CHANNEL: Record<string, string> = { SMS: "SMS", EMAIL: "E-posta", WHATSAPP: "WhatsApp" };
const SYNC: Record<string, { label: string; tone: "warning" | "success" | "danger" | "muted" | "info" }> = {
  PENDING: { label: "Bekliyor", tone: "warning" },
  PROCESSING: { label: "İşleniyor", tone: "info" },
  SYNCED: { label: "Senkron", tone: "success" },
  FAILED: { label: "Hata", tone: "danger" },
};

export default async function AppointmentDetailPage({ params, searchParams }: PageProps<"/admin/randevular/[id]">) {
  const ctx = await requirePagePermission("APPOINTMENT_VIEW");
  const { id } = await params;
  const { geri } = await searchParams;
  // Yalnızca takvim sayfasına dönüşe izin ver (open redirect olmasın)
  const fromCalendar = typeof geri === "string" && /^\/admin\/randevular\/takvim(\?[\w=&%.-]*)?$/.test(geri);
  const [{ appointment, candidates }, dentists] = await Promise.all([
    loadOrNotFound(() => getAppointmentDetail(ctx, id)),
    listDentistOptions(ctx),
  ]);
  const name = appointmentPersonName(appointment);
  const canEdit = can(ctx, "APPOINTMENT_EDIT");
  const durationMin = Math.round((appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60_000);

  return (
    <>
      <PageHeader
        title={name}
        back={fromCalendar ? { href: geri as string, label: "Takvim" } : { href: "/admin/randevular", label: "Randevular" }}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <AppointmentStatusBadge status={appointment.status} />
            {appointment.attendanceResponse ? <AttendanceBadge response={appointment.attendanceResponse} /> : null}
            <span>
              {formatLongDate(appointment.startsAt)} · {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}
            </span>
          </span>
        }
        actions={
          appointment.patientId && can(ctx, "PATIENT_VIEW") ? (
            <Button asChild variant="outline">
              <Link href={`/admin/hastalar/${appointment.patientId}`}>Hasta kartı</Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Randevu bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
              <Info label="Doktor" value={dentistName(appointment.dentist)} />
              <Info label="Hizmet" value={appointment.service?.name ?? "—"} />
              <Info label="Süre" value={`${durationMin} dk`} />
              <Info label="Kaynak" value={SOURCE_LABELS[appointment.source] ?? appointment.source} />
              <Info
                label="Telefon"
                value={
                  <a href={`tel:${appointment.requesterPhone}`} className="inline-flex items-center gap-1 hover:underline">
                    <Phone className="size-3.5" aria-hidden />
                    {formatPhone(appointment.patient?.phone ?? appointment.requesterPhone)}
                  </a>
                }
              />
              <Info
                label="E-posta"
                value={
                  appointment.requesterEmail ? (
                    <a href={`mailto:${appointment.requesterEmail}`} className="inline-flex items-center gap-1 hover:underline">
                      <Mail className="size-3.5" aria-hidden />
                      {appointment.requesterEmail}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              {appointment.reason ? <Info label="Neden" value={appointment.reason} className="sm:col-span-2" /> : null}
              {appointment.patientMessage ? (
                <Info label="Hasta açıklaması" value={appointment.patientMessage} className="sm:col-span-2" />
              ) : null}
              {appointment.statusReason ? (
                <Info label="Durum açıklaması" value={appointment.statusReason} className="sm:col-span-2" />
              ) : null}
              {appointment.privacyNoticeAckAt ? (
                <Info
                  label="KVKK"
                  value={`Aydınlatma onaylandı (${appointment.privacyNoticeVer ?? "—"}) · ${formatDateTime(appointment.privacyNoticeAckAt)}`}
                  className="sm:col-span-2"
                />
              ) : null}
              {!appointment.patient ? (
                <p className="sm:col-span-2 text-xs text-muted-foreground">Hasta kartı henüz bağlanmamış (kayıtsız talep).</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>İşlemler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AppointmentStatusActions
                appointmentId={appointment.id}
                status={appointment.status}
                hasPatient={Boolean(appointment.patientId)}
                candidates={candidates}
                canApprove={can(ctx, "APPOINTMENT_APPROVE")}
                canEdit={canEdit}
                canManagePatient={can(ctx, "PATIENT_MANAGE")}
              />
              {canEdit && canTransition("reschedule", appointment.status) ? (
                <AppointmentRescheduleForm
                  appointmentId={appointment.id}
                  dentists={dentists.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }))}
                  currentDentistId={appointment.dentistId}
                  currentStartsAt={appointment.startsAt.toISOString()}
                />
              ) : null}
            </CardContent>
          </Card>

          {canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Dahili notlar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AppointmentNoteForm appointmentId={appointment.id} />
                {appointment.notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Henüz not yok.</p>
                ) : (
                  <ul className="space-y-3">
                    {appointment.notes.map((n) => (
                      <li key={n.id} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
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
          ) : null}

          {Array.isArray(appointment.treatments) && appointment.treatments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Bu randevuya bağlı muayene</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {appointment.treatments.map((t) => (
                    <li key={t.id}>
                      <Link href={`/admin/hastalar/${appointment.patientId}/muayene/${t.id}`} className="hover:underline">
                        {t.procedure}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : appointment.patientId && can(ctx, "TREATMENT_MANAGE") ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/hastalar/${appointment.patientId}/muayene/yeni?randevu=${appointment.id}`}>
                <FileText aria-hidden /> Muayene kaydı ekle
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Durum geçmişi</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {appointment.statusHistory.map((h) => (
                  <li key={h.id} className="border-l-2 border-border pl-3">
                    <p className="font-medium">{HISTORY_EVENT_LABELS[h.event] ?? h.event}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.createdAt)}
                      {h.changedBy ? ` · ${h.changedBy.name}` : ""}
                    </p>
                    {h.note ? <p className="mt-1 text-muted-foreground">{h.note}</p> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bildirimler</CardTitle>
            </CardHeader>
            <CardContent>
              {appointment.notifications.length === 0 ? (
                <EmptyState icon={MessageSquare} title="Henüz bildirim yok" className="py-6" />
              ) : (
                <ul className="space-y-3 text-sm">
                  {appointment.notifications.map((n) => {
                    const s = NOTIF_STATUS[n.status] ?? { label: n.status, tone: "muted" as const };
                    return (
                      <li key={n.id} className="flex items-start justify-between gap-2">
                        <div>
                          <p>
                            {CHANNEL[n.channel] ?? n.channel} · {NOTIF_TEMPLATE[n.template] ?? n.template}
                          </p>
                          {n.lastError ? <p className="text-xs text-danger-foreground">{n.lastError}</p> : null}
                        </div>
                        <ToneBadge tone={s.tone}>{s.label}</ToneBadge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Takvim senkronu</CardTitle>
            </CardHeader>
            <CardContent>
              {appointment.calendarEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Google Calendar bağlı değil veya bu randevu için senkron kaydı yok.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {appointment.calendarEvents.map((e) => {
                    const s = SYNC[e.syncStatus] ?? { label: e.syncStatus, tone: "muted" as const };
                    return (
                      <li key={e.id} className="flex items-center justify-between gap-2">
                        <span>
                          {e.desiredState === "ABSENT" ? "Takvimden kaldırılacak" : "Takvimde"}
                          {e.lastError ? <span className="block text-xs text-danger-foreground">{e.lastError}</span> : null}
                        </span>
                        <ToneBadge tone={s.tone}>{s.label}</ToneBadge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {can(ctx, "APPOINTMENT_CREATE") ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/randevular/yeni${appointment.patientId ? `?hasta=${appointment.patientId}` : ""}`}>
                <CalendarPlus aria-hidden /> Bu hasta için yeni randevu
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
