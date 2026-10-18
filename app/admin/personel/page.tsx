import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ToneBadge } from "@/components/shared/status-badge";
import { listStaff } from "@/features/staff/service";
import { requirePagePermission } from "@/lib/auth/current";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Personel" };

export default async function StaffPage() {
  const ctx = await requirePagePermission("STAFF_MANAGE");
  const staff = await listStaff(ctx);
  return (
    <>
      <PageHeader
        title="Personel ve yetkiler"
        actions={
          <Button asChild>
            <Link href="/admin/personel/yeni">
              <Plus aria-hidden /> Çalışan ekle
            </Link>
          </Button>
        }
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>E-posta</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="hidden md:table-cell">Son giriş</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((m) => (
              <TableRow key={m.id} className="relative">
                <TableCell>
                  <Link href={`/admin/personel/${m.id}`} className="font-medium after:absolute after:inset-0">
                    {m.user.name}
                  </Link>
                </TableCell>
                <TableCell>{m.user.email}</TableCell>
                <TableCell>{ROLE_LABELS[m.role]}</TableCell>
                <TableCell>{m.isActive ? <ToneBadge tone="success">Aktif</ToneBadge> : <ToneBadge tone="muted">Pasif</ToneBadge>}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {m.user.lastLoginAt ? formatDateTime(m.user.lastLoginAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
