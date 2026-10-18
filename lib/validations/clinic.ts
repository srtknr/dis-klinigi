import { z } from "zod";
import { idField } from "@/lib/validations/common";

const optional = (max: number) => z.string().trim().max(max).optional();

export const clinicSchema = z.object({
  name: z.string().trim().min(2, "Klinik adını girin.").max(120),
  tagline: optional(200),
  about: optional(2000),
  phone: optional(40),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Geçerli bir e-posta adresi girin.")
    .optional(),
  notificationEmail: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Geçerli bir e-posta adresi girin.")
    .optional(),
  address: optional(300),
  city: optional(80),
  workingHoursText: optional(300),
  mapEmbedUrl: z
    .string()
    .trim()
    .max(1000)
    .refine(
      (v) =>
        v === "" ||
        /^https:\/\/(www\.google\.com\/maps\/embed|maps\.google\.com\/maps|www\.openstreetmap\.org\/export\/embed\.html)/.test(v),
      "Yalnızca Google Maps veya OpenStreetMap gömme (embed) bağlantıları kabul edilir.",
    )
    .optional(),
});
export type ClinicInput = z.infer<typeof clinicSchema>;

export const serviceSchema = z.object({
  serviceId: z.string().trim().optional(),
  name: z.string().trim().min(2, "Hizmet adını girin.").max(120),
  description: optional(1000),
  durationMinutes: z.coerce.number().int().min(10).max(240).optional(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

export const idOnlySchema = z.object({ id: idField });
