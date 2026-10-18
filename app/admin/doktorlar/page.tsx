import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { ToneBadge } from "@/components/shared/status-badge";
import { listDentists } from "@/features/dentists/service";
import { requirePagePermission } from "@/lib/auth/current";
import { can } from "@/lib/permissions";
import { dentistName, fullName } from "@/lib/text";
import { WEEKDAY_LABELS, minutesToHHMM } from "@/lib/time";

export const metadata: Metadata = { title: "Doktorlar" };

export default async function DentistsAdminPage() {
  const ctx = await requirePagePermission("DENTIST_VIEW");
  const dentists = await listDentists(ctx);
  return (
    <>
      <PageHeader
        title="Doktorlar"
        description="Çalışma saatleri, izinler ve online randevu ayarları."
        actions={
          can(ctx, "DENTIST_MANAGE") ? (
            <Button asChild>
              <Link href="/admin/doktorlar/yeni">
                <Plus aria-hidden /> Doktor ekle
              </Link>
            </Button>
          ) : null
        }
      />
      {dentists.length === 0 ? (
        <EmptyState icon={Stethoscope} title="Henüz doktor eklenmedi" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dentists.map((d) => {
            const name = dentistName(d);
            return (
              <li key={d.id}>
                <Link href={`/admin/doktorlar/${d.id}`} className="flex h-full flex-col rounded-xl border bg-card p-5 hover:border-ring">
                  <div className="flex items-start gap-3">
                    <PersonAvatar name={name} initialsOf={fullName(d.firstName, d.lastName)} photoUrl={d.photoUrl} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">{d.specialty}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {d.isActive ? <ToneBadge tone="success">Aktif</ToneBadge> : <ToneBadge tone="muted">Pasif</ToneBadge>}
                        {d.acceptsOnlineBooking ? (
                          <ToneBadge tone="info">Online randevu</ToneBadge>
                        ) : (
                          <ToneBadge tone="muted">Yalnızca telefon</ToneBadge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {d.workingHours.length === 0
                      ? "Çalışma saati yok"
                      : d.workingHours
                          .map((h) => `${WEEKDAY_LABELS[h.weekday]?.slice(0, 3)} ${minutesToHHMM(h.startMinute)}–${minutesToHHMM(h.endMinute)}`)
                          .join(" · ")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
