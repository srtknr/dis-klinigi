import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/public/page-intro";
import { AppointmentRequestForm } from "@/components/public/appointment-request-form";
import { PUBLIC_BOOKING_HORIZON_DAYS } from "@/features/calendar/service";
import { getPublicClinic, getPublicDentists, getPublicServices } from "@/features/public/queries";
import { dentistName } from "@/lib/text";
import { addDaysToKey, todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Online Randevu Talebi" };

export default async function AppointmentRequestPage({ searchParams }: PageProps<"/randevu">) {
  const clinic = await getPublicClinic();
  if (!clinic) notFound();
  const [dentists, services, sp] = await Promise.all([
    getPublicDentists(clinic.id),
    getPublicServices(clinic.id),
    searchParams,
  ]);
  const requestedSlug = typeof sp.doktor === "string" ? sp.doktor : undefined;
  const bookable = dentists.filter((d) => d.acceptsOnlineBooking);
  const today = todayKey();

  return (
    <>
      <PageIntro
        eyebrow="Online randevu"
        title="Randevu talebi oluşturun"
        description="Hekiminizi ve size uygun saati seçin. Talebiniz klinik ekibimiz tarafından onaylandığında size SMS ile bilgi verilecektir."
      />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <AppointmentRequestForm
          dentists={bookable.map((d) => ({
            id: d.id,
            slug: d.slug,
            name: dentistName(d),
            specialty: d.specialty,
            weekdays: d.workingHours.map((h) => h.weekday),
          }))}
          services={services.map((s) => ({ id: s.id, name: s.name }))}
          initialDentistId={bookable.find((d) => d.slug === requestedSlug)?.id}
          minDateKey={today}
          maxDateKey={addDaysToKey(today, PUBLIC_BOOKING_HORIZON_DAYS)}
          clinicPhone={clinic.phone}
          hasOfflineDentists={bookable.length < dentists.length}
        />
      </div>
    </>
  );
}
