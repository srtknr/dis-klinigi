import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarPlus, ClipboardList, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { AppointmentStatusBadge } from "@/components/shared/status-badge";
import { listAppointments } from "@/features/appointments/queries";
import { appointmentPersonName, SOURCE_LABELS } from "@/features/appointments/format";
import { ALL_STATUSES, APPOINTMENT_STATUS_LABELS } from "@/features/appointments/status";
import { listDentistOptions } from "@/features/dentists/service";
import { requirePagePermission } from "@/lib/auth/current";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { dentistName } from "@/lib/text";
import { formatDate, formatTime } from "@/lib/time";
import { appointmentFiltersSchema } from "@/lib/validations/appointment";

export const metadata: Metadata = { title: "Randevular" };

function pick(v: string | string[] | undefined) {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export default async function AppointmentsPage({ searchParams }: PageProps<"/admin/randevular">) {
  const ctx = await requirePagePermission("APPOINTMENT_VIEW");
  const sp = await searchParams;
  const parsed = appointmentFiltersSchema.safeParse({
    q: pick(sp.q),
    status: pick(sp.status),
    dentistId: pick(sp.dentistId),
    from: pick(sp.from),
    to: pick(sp.to),
    page: pick(sp.page),
  });
  const filters = parsed.success ? parsed.data : {};
  const [result, dentists] = await Promise.all([listAppointments(ctx, filters), listDentistOptions(ctx)]);
  const hasFilters = Boolean(filters.q || filters.status || filters.dentistId || filters.from || filters.to);

  return (
    <>
      <PageHeader
        title="Randevular"
        description="Online talepleri ve panelden oluşturulan randevuları buradan yönetin."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/randevular/takvim">
                <CalendarDays aria-hidden /> Takvim görünümü
              </Link>
            </Button>
            {can(ctx, "APPOINTMENT_CREATE") ? (
              <Button asChild>
                <Link href="/admin/randevular/yeni">
                  <CalendarPlus aria-hidden /> Yeni randevu
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <form method="get" role="search" className="mb-5 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1.4fr_1fr_1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={filters.q} placeholder="Ad, soyad veya telefon" aria-label="Arama" className="pl-9" />
        </div>
        <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label="Durum">
          <option value="">Tüm durumlar</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPOINTMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="dentistId" defaultValue={filters.dentistId ?? ""} aria-label="Doktor">
          <option value="">Tüm doktorlar</option>
          {dentists.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.isActive ? "" : " (pasif)"}
            </option>
          ))}
        </NativeSelect>
        <Input type="date" name="from" defaultValue={filters.from} aria-label="Başlangıç tarihi" />
        <Input type="date" name="to" defaultValue={filters.to} aria-label="Bitiş tarihi" />
        <div className="flex gap-2">
          <Button type="submit">Filtrele</Button>
          {hasFilters ? (
            <Button asChild variant="ghost">
              <Link href="/admin/randevular">Temizle</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={hasFilters ? "Filtrelere uyan randevu bulunamadı" : "Henüz randevu yok"}
          description={hasFilters ? "Arama ölçütlerini değiştirerek tekrar deneyin." : "Online talepler ve panelden oluşturulan randevular burada listelenir."}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih / Saat</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead className="hidden md:table-cell">Doktor</TableHead>
                <TableHead className="hidden lg:table-cell">Hizmet</TableHead>
                <TableHead className="hidden lg:table-cell">Kaynak</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((a) => (
                <TableRow key={a.id} className="relative">
                  <TableCell className="tabular-nums">
                    <Link href={`/admin/randevular/${a.id}`} className="after:absolute after:inset-0">
                      <span className="font-medium">{formatDate(a.startsAt)}</span>
                      <span className="ml-2 text-muted-foreground">{formatTime(a.startsAt)}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{appointmentPersonName(a)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPhone(a.patient?.phone ?? a.requesterPhone)}
                      {!a.patient ? " · kayıtsız" : ""}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{dentistName(a.dentist)}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{a.service?.name ?? "—"}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{SOURCE_LABELS[a.source] ?? a.source}</TableCell>
                  <TableCell>
                    <AppointmentStatusBadge status={a.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        basePath="/admin/randevular"
        params={{ q: filters.q, status: filters.status, dentistId: filters.dentistId, from: filters.from, to: filters.to }}
      />
    </>
  );
}
