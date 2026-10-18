import type { Metadata } from "next";
import { StaffForm } from "@/components/admin/staff-form";
import { PageHeader } from "@/components/shared/page-header";
import { listDentistOptions } from "@/features/dentists/service";
import { getStaffMember } from "@/features/staff/service";
import { requirePagePermission } from "@/lib/auth/current";
import { loadOrNotFound } from "@/lib/http/load-or-not-found";
import type { PermissionKey } from "@/lib/permissions";

export const metadata: Metadata = { title: "Çalışan" };

export default async function StaffDetailPage({ params }: PageProps<"/admin/personel/[id]">) {
  const ctx = await requirePagePermission("STAFF_MANAGE");
  const { id } = await params;
  const [member, dentists] = await Promise.all([
    loadOrNotFound(() => getStaffMember(ctx, id)),
    listDentistOptions(ctx),
  ]);
  return (
    <>
      <PageHeader title={member.user.name} back={{ href: "/admin/personel", label: "Personel" }} description={member.user.email} />
      <StaffForm
        membershipId={member.id}
        isSelf={member.userId === ctx.userId}
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
        initial={{
          name: member.user.name,
          email: member.user.email,
          role: member.role,
          permissions: member.permissions as PermissionKey[],
          isActive: member.isActive,
          dentistProfileId: member.user.dentistProfile?.id ?? "",
        }}
      />
    </>
  );
}
