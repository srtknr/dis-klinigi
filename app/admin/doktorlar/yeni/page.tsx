import type { Metadata } from "next";
import { DentistProfileForm } from "@/components/admin/dentist-profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Doktor ekle" };

export default async function NewDentistPage() {
  await requirePagePermission("DENTIST_MANAGE");
  return (
    <>
      <PageHeader title="Doktor ekle" back={{ href: "/admin/doktorlar", label: "Doktorlar" }} />
      <DentistProfileForm
        initial={{
          title: "Dt.",
          firstName: "",
          lastName: "",
          specialty: "",
          bio: "",
          slotMinutes: 30,
          isActive: true,
          acceptsOnlineBooking: true,
          sortOrder: 0,
        }}
      />
    </>
  );
}
