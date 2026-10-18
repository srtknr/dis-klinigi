import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Public site yalnızca tek bir kliniği gösterir (PUBLIC_CLINIC_SLUG). Çoklu klinikte alan adına
 * göre çözümleme yapılabilir. Bu sorgular hasta verisi döndürmez.
 */
export const getPublicClinic = cache(async () => {
  const slug = process.env.PUBLIC_CLINIC_SLUG ?? "demo-klinik";
  return db.clinic.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      tagline: true,
      about: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      mapEmbedUrl: true,
      workingHoursText: true,
      isDemo: true,
    },
  });
});

export type PublicClinic = NonNullable<Awaited<ReturnType<typeof getPublicClinic>>>;

const publicDentistSelect = {
  id: true,
  slug: true,
  title: true,
  firstName: true,
  lastName: true,
  specialty: true,
  bio: true,
  photoUrl: true,
  acceptsOnlineBooking: true,
  slotMinutes: true,
  workingHours: {
    orderBy: { weekday: "asc" },
    select: { weekday: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true },
  },
} as const;

export const getPublicDentists = cache(async (clinicId: string) =>
  db.dentistProfile.findMany({
    where: { clinicId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { lastName: "asc" }],
    select: publicDentistSelect,
  }),
);

export type PublicDentist = Awaited<ReturnType<typeof getPublicDentists>>[number];

export const getPublicDentistBySlug = cache(async (clinicId: string, slug: string) =>
  db.dentistProfile.findFirst({ where: { clinicId, slug, isActive: true }, select: publicDentistSelect }),
);

export const getPublicServices = cache(async (clinicId: string) =>
  db.service.findMany({
    where: { clinicId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, description: true, durationMinutes: true },
  }),
);

/** Talep sonuç sayfası: yalnızca son 24 saatte oluşturulmuş talebin planlama bilgisi (kişisel veri yok) */
export async function getRequestSummary(clinicId: string, appointmentId: string, now = new Date()) {
  return db.appointment.findFirst({
    where: { id: appointmentId, clinicId, source: "PUBLIC_WEBSITE", createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
    select: {
      id: true,
      startsAt: true,
      status: true,
      dentist: { select: { title: true, firstName: true, lastName: true } },
      service: { select: { name: true } },
    },
  });
}
