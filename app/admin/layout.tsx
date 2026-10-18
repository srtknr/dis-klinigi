import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageAuth } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Yönetim Paneli", template: "%s · Yönetim Paneli" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const ctx = await requirePageAuth();
  const [pendingCount, clinic] = await Promise.all([
    can(ctx, "APPOINTMENT_VIEW")
      ? db.appointment.count({ where: { clinicId: ctx.clinicId, status: "PENDING", startsAt: { gte: new Date() } } })
      : 0,
    db.clinic.findUnique({ where: { id: ctx.clinicId }, select: { isDemo: true } }),
  ]);

  return (
    <AdminShell
      clinicName={ctx.clinicName}
      userName={ctx.userName}
      role={ctx.role}
      permissions={ctx.permissions}
      pendingCount={pendingCount}
      isDemo={clinic?.isDemo ?? false}
    >
      {children}
    </AdminShell>
  );
}
