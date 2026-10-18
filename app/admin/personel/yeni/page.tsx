import type { Metadata } from "next";
import { StaffForm } from "@/components/admin/staff-form";
import { PageHeader } from "@/components/shared/page-header";
import { listDentistOptions } from "@/features/dentists/service";
import { requirePagePermission } from "@/lib/auth/current";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Çalışan ekle" };

export default async function NewStaffPage() {
  const ctx = await requirePagePermission("STAFF_MANAGE");
  const dentists = await listDentistOptions(ctx);
  return (
    <>
      <PageHeader title="Çalışan ekle" back={{ href: "/admin/personel", label: "Personel" }} />
      <StaffForm
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
        initial={{
          name: "",
          email: "",
          role: "EDITOR",
          permissions: DEFAULT_ROLE_PERMISSIONS.EDITOR,
          isActive: true,
          dentistProfileId: "",
        }}
      />
    </>
  );
}
