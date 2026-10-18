import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DentistBlockedForm, RemoveBlockedButton } from "@/components/admin/dentist-blocked-form";
import { DentistHoursForm } from "@/components/admin/dentist-hours-form";
import { DentistPhotoForm } from "@/components/admin/dentist-photo-form";
import { DentistProfileForm } from "@/components/admin/dentist-profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { ToneBadge } from "@/components/shared/status-badge";
import { getDentistDetail } from "@/features/dentists/service";
import { requirePagePermission } from "@/lib/auth/current";
import { loadOrNotFound } from "@/lib/http/load-or-not-found";
import { can } from "@/lib/permissions";
import { dentistName, fullName } from "@/lib/text";
import { formatDateTime, minutesToHHMM, WEEKDAY_LABELS } from "@/lib/time";

export const metadata: Metadata = { title: "Doktor" };

const BLOCK_LABEL: Record<string, string> = { LEAVE: "İzin", BREAK: "Mola", OTHER: "Diğer" };

export default async function DentistDetailPage({ params }: PageProps<"/admin/doktorlar/[id]">) {
  const ctx = await requirePagePermission("DENTIST_VIEW");
  const { id } = await params;
  const dentist = await loadOrNotFound(() => getDentistDetail(ctx, id));
  const manage = can(ctx, "DENTIST_MANAGE");
  const name = dentistName(dentist);
  const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const h = dentist.workingHours.find((x) => x.weekday === weekday);
    return {
      weekday,
      enabled: Boolean(h),
      start: h ? minutesToHHMM(h.startMinute) : "09:00",
      end: h ? minutesToHHMM(h.endMinute) : "18:00",
      breakStart: h?.breakStartMinute != null ? minutesToHHMM(h.breakStartMinute) : "12:30",
      breakEnd: h?.breakEndMinute != null ? minutesToHHMM(h.breakEndMinute) : "13:30",
    };
  });

  return (
    <>
      <PageHeader
        title={name}
        back={{ href: "/admin/doktorlar", label: "Doktorlar" }}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {dentist.specialty}
            {dentist.isActive ? <ToneBadge tone="success">Aktif</ToneBadge> : <ToneBadge tone="muted">Pasif</ToneBadge>}
          </span>
        }
      />

      <div className="mb-6 flex items-center gap-4">
        <PersonAvatar name={name} initialsOf={fullName(dentist.firstName, dentist.lastName)} photoUrl={dentist.photoUrl} size={72} />
        {dentist.calendarConnections[0] ? (
          <p className="text-sm text-muted-foreground">
            Google: {dentist.calendarConnections[0].googleEmail} ({dentist.calendarConnections[0].status})
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Google Takvim bağlı değil.</p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent>
            {manage ? (
              <DentistProfileForm
                dentistId={dentist.id}
                initial={{
                  title: dentist.title,
                  firstName: dentist.firstName,
                  lastName: dentist.lastName,
                  specialty: dentist.specialty,
                  bio: dentist.bio ?? "",
                  slotMinutes: dentist.slotMinutes,
                  isActive: dentist.isActive,
                  acceptsOnlineBooking: dentist.acceptsOnlineBooking,
                  sortOrder: dentist.sortOrder,
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{dentist.bio ?? "Biyografi yok."}</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {manage ? (
            <Card>
              <CardHeader>
                <CardTitle>Fotoğraf</CardTitle>
              </CardHeader>
              <CardContent>
                <DentistPhotoForm dentistId={dentist.id} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Çalışma saatleri</CardTitle>
            </CardHeader>
            <CardContent>
              {manage ? (
                <DentistHoursForm dentistId={dentist.id} initialDays={days} />
              ) : (
                <ul className="text-sm">
                  {days.map((d) => (
                    <li key={d.weekday} className="flex justify-between py-1">
                      <span>{WEEKDAY_LABELS[d.weekday]}</span>
                      <span>{d.enabled ? `${d.start}–${d.end}` : "Kapalı"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>İzin ve kapalı zamanlar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dentist.blockedTimes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Yaklaşan izin kaydı yok.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {dentist.blockedTimes.map((b) => (
                    <li key={b.id} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2">
                      <div>
                        <p className="font-medium">{BLOCK_LABEL[b.type] ?? b.type}</p>
                        <p className="text-muted-foreground">
                          {formatDateTime(b.startsAt)} – {formatDateTime(b.endsAt)}
                        </p>
                        {b.reason ? <p>{b.reason}</p> : null}
                      </div>
                      {manage ? <RemoveBlockedButton id={b.id} /> : null}
                    </li>
                  ))}
                </ul>
              )}
              {manage ? <DentistBlockedForm dentistId={dentist.id} /> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
