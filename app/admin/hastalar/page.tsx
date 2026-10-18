import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { AppointmentStatusBadge } from "@/components/shared/status-badge";
import { listPatients } from "@/features/patients/service";
import { requirePagePermission } from "@/lib/auth/current";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Hastalar" };

export default async function PatientsPage({ searchParams }: PageProps<"/admin/hastalar">) {
  const ctx = await requirePagePermission("PATIENT_VIEW");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;
  const result = await listPatients(ctx, { q, page: Number.isFinite(page) ? page : 1 });

  return (
    <>
      <PageHeader
        title="Hastalar"
        actions={
          can(ctx, "PATIENT_MANAGE") ? (
            <Button asChild>
              <Link href="/admin/hastalar/yeni">
                <Plus aria-hidden /> Hasta ekle
              </Link>
            </Button>
          ) : null
        }
      />
      <form method="get" className="mb-5 flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Ad, soyad veya telefon" className="pl-9" aria-label="Hasta ara" />
        </div>
        <Button type="submit">Ara</Button>
      </form>
      {result.items.length === 0 ? (
        <EmptyState icon={Users} title={q ? "Eşleşen hasta yok" : "Henüz hasta kaydı yok"} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hasta</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="hidden md:table-cell">Son randevu</TableHead>
                <TableHead className="hidden lg:table-cell">Kayıt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((p) => {
                const last = p.appointments[0];
                return (
                  <TableRow key={p.id} className="relative">
                    <TableCell>
                      <Link href={`/admin/hastalar/${p.id}`} className="font-medium after:absolute after:inset-0">
                        {p.firstName} {p.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{formatPhone(p.phone)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {last ? (
                        <span className="inline-flex items-center gap-2">
                          {formatDate(last.startsAt)} <AppointmentStatusBadge status={last.status} />
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(p.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} total={result.total} basePath="/admin/hastalar" params={{ q }} />
    </>
  );
}
