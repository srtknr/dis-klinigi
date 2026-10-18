import type { Metadata } from "next";
import { ClinicSettingsForm } from "@/components/admin/clinic-settings-form";
import { ServiceListForm } from "@/components/admin/service-list-form";
import { PageHeader } from "@/components/shared/page-header";
import { getClinicSettings } from "@/features/clinic/service";
import { requirePagePermission } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Klinik ayarları" };

export default async function ClinicSettingsPage() {
  const ctx = await requirePagePermission("SETTINGS_MANAGE");
  const clinic = await getClinicSettings(ctx);
  return (
    <>
      <PageHeader title="Klinik ayarları" description="Bu bilgiler web sitesinde yayınlanır." />
      <div className="grid gap-8 xl:grid-cols-2">
        <ClinicSettingsForm
          initial={{
            name: clinic.name,
            tagline: clinic.tagline ?? "",
            about: clinic.about ?? "",
            phone: clinic.phone ?? "",
            email: clinic.email ?? "",
            notificationEmail: clinic.notificationEmail ?? "",
            address: clinic.address ?? "",
            city: clinic.city ?? "",
            workingHoursText: clinic.workingHoursText ?? "",
            mapEmbedUrl: clinic.mapEmbedUrl ?? "",
          }}
        />
        <ServiceListForm
          services={clinic.services.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description ?? "",
            durationMinutes: s.durationMinutes ?? undefined,
            isActive: s.isActive,
            sortOrder: s.sortOrder,
          }))}
        />
      </div>
    </>
  );
}
