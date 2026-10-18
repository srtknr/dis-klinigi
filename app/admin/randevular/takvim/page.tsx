import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentCalendar } from "@/components/admin/appointment-calendar";
import { PageHeader } from "@/components/shared/page-header";
import { listDentistOptions } from "@/features/dentists/service";
import { requirePagePermission } from "@/lib/auth/current";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Takvim" };

export default async function CalendarPage() {
  const ctx = await requirePagePermission("APPOINTMENT_VIEW");
  const dentists = await listDentistOptions(ctx);
  return (
    <>
      <PageHeader
        title="Randevu takvimi"
        description="Günlük, haftalık ve aylık görünüm. Ayrıntılar için randevuya tıklayın. Saatler Türkiye saatidir."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/randevular">
                <List aria-hidden /> Liste görünümü
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
      <AppointmentCalendar dentists={dentists.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }))} />
    </>
  );
}
