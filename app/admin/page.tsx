import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarClock, CalendarPlus, CalendarX, CheckCheck, Inbox, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AppointmentStatusBadge } from "@/components/shared/status-badge";
import { getDashboardData, type AppointmentListItem } from "@/features/appointments/queries";
import { appointmentPersonName } from "@/features/appointments/format";
import { HISTORY_EVENT_LABELS } from "@/features/appointments/status";
import { requirePageAuth } from "@/lib/auth/current";
import { can } from "@/lib/permissions";
import { dentistName } from "@/lib/text";
import { formatDate, formatDateTime, formatLongDate, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Genel Bakış" };

export default async function DashboardPage() {
  const ctx = await requirePageAuth();
  const now = new Date();

  if (!can(ctx, "APPOINTMENT_VIEW")) {
    return (
      <>
        <PageHeader title={`Hoş geldiniz, ${ctx.userName}`} description={formatLongDate(now)} />
        <EmptyState title="Görüntüleyebileceğiniz bir özet yok" description="Hesabınıza randevu görüntüleme yetkisi tanımlanmamış. Klinik sahibiyle iletişime geçin." />
      </>
    );
  }

  const data = await getDashboardData(ctx, now);
  const canCreate = can(ctx, "APPOINTMENT_CREATE");

  return (
    <>
      <PageHeader
        title={`Hoş geldiniz, ${ctx.userName.split(" ")[0]}`}
        description={formatLongDate(now)}
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/admin/randevular/yeni">
                <CalendarPlus aria-hidden /> Yeni randevu
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Bugünkü randevular" value={data.stats.todayCount} icon={CalendarClock} href="/admin/randevular/takvim" />
        <StatCard
          label="Onay bekleyen"
          value={data.stats.pendingCount}
          icon={Inbox}
          href="/admin/randevular?status=PENDING"
          highlight={data.stats.pendingCount > 0}
        />
        <StatCard label="Yaklaşan onaylı" value={data.stats.confirmedCount} icon={CalendarCheck} href="/admin/randevular?status=CONFIRMED" />
        <StatCard label="Tamamlanan" value={data.stats.completedCount} hint="Son 30 gün" icon={CheckCheck} />
        <StatCard label="İptal edilen" value={data.stats.cancelledCount} hint="Son 30 gün" icon={CalendarX} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Bugünün programı</CardTitle>
            <CardAction>
              <Link href="/admin/randevular/takvim" className="text-sm text-primary hover:underline underline-offset-4">Takvim</Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.todayItems.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Bugün planlanmış randevu yok" className="py-8" />
            ) : (
              <AppointmentRows items={data.todayItems} timeOnly />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Onay bekleyen talepler</CardTitle>
            <CardAction>
              <Link href="/admin/randevular?status=PENDING" className="text-sm text-primary hover:underline underline-offset-4">Tümü</Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.pendingItems.length === 0 ? (
              <EmptyState icon={Inbox} title="Bekleyen talep yok" className="py-8" />
            ) : (
              <AppointmentRows items={data.pendingItems} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Önümüzdeki 7 gün</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingItems.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Yaklaşan onaylı randevu yok" className="py-8" />
            ) : (
              <AppointmentRows items={data.upcomingItems} />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Son işlemler</CardTitle>
            </CardHeader>
            <CardContent>
              {data.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz işlem yok.</p>
              ) : (
                <ul className="space-y-3">
                  {data.activity.map((h) => (
                    <li key={h.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <Link href={`/admin/randevular/${h.appointment.id}`} className="font-medium hover:underline underline-offset-4">
                          {h.appointment.requesterFirstName} {h.appointment.requesterLastName}
                        </Link>
                        <p className="text-muted-foreground">
                          {HISTORY_EVENT_LABELS[h.event] ?? h.event}
                          {h.changedBy ? ` · ${h.changedBy.name}` : ""}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground" dateTime={h.createdAt.toISOString()}>
                        {formatDateTime(h.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {data.recentPatients ? (
            <Card>
              <CardHeader>
                <CardTitle>Yeni hasta kayıtları</CardTitle>
                {can(ctx, "PATIENT_MANAGE") ? (
                  <CardAction>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/admin/hastalar/yeni">
                        <UserPlus aria-hidden /> Hasta ekle
                      </Link>
                    </Button>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent>
                {data.recentPatients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Henüz hasta kaydı yok.</p>
                ) : (
                  <ul className="divide-y">
                    {data.recentPatients.map((p) => (
                      <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                        <Link href={`/admin/hastalar/${p.id}`} className="font-medium hover:underline underline-offset-4">
                          {p.firstName} {p.lastName}
                        </Link>
                        <span className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function AppointmentRows({ items, timeOnly }: { items: AppointmentListItem[]; timeOnly?: boolean }) {
  return (
    <ul className="divide-y">
      {items.map((a) => (
        <li key={a.id}>
          <Link
            href={`/admin/randevular/${a.id}`}
            className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3 hover:bg-muted/60"
          >
            <div className="w-20 shrink-0 text-sm tabular-nums">
              <p className="font-medium">{formatTime(a.startsAt)}</p>
              {!timeOnly ? <p className="text-xs text-muted-foreground">{formatDate(a.startsAt)}</p> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{appointmentPersonName(a)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {dentistName(a.dentist)}
                {a.service ? ` · ${a.service.name}` : ""}
              </p>
            </div>
            <AppointmentStatusBadge status={a.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
