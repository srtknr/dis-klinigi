import { z } from "zod";
import {
  dateKeyField,
  idField,
  nameField,
  optionalEmailField,
  optionalText,
  phoneField,
  timeField,
} from "@/lib/validations/common";

export const PRIVACY_NOTICE_VERSION = "2026-10-v1";

export const publicAppointmentSchema = z
  .object({
    firstName: nameField("Ad"),
    lastName: nameField("Soyad"),
    phone: phoneField,
    email: optionalEmailField,
    dentistId: z.string().trim().min(1, "Lütfen bir doktor seçin."),
    serviceId: z.string().trim().optional(),
    date: dateKeyField,
    startTime: timeField,
    message: optionalText(500, "Açıklama"),
    privacyNoticeAck: z.boolean().refine((v) => v === true, {
      message: "Devam etmek için aydınlatma metnini okuduğunuzu onaylayın.",
    }),
    explicitConsent: z.boolean().optional(),
    /** Bot tuzağı: gerçek kullanıcılar bu alanı görmez ve boş bırakır */
    website: z.string().max(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.message && value.message.trim().length > 0 && !value.explicitConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["explicitConsent"],
        message: "Açıklama alanına bilgi yazdıysanız bu bilgilerin işlenmesine açık rıza vermeniz gerekir; isterseniz açıklamayı boş bırakabilirsiniz.",
      });
    }
  });

export type PublicAppointmentInput = z.infer<typeof publicAppointmentSchema>;

export const availabilityQuerySchema = z.object({
  dentistId: idField,
  date: dateKeyField,
});

const patientChoice = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), patientId: idField }),
  z.object({
    mode: z.literal("new"),
    firstName: nameField("Ad"),
    lastName: nameField("Soyad"),
    phone: phoneField,
    email: optionalEmailField,
  }),
]);

export const adminAppointmentSchema = z.object({
  patient: patientChoice,
  dentistId: z.string().trim().min(1, "Doktor seçin."),
  serviceId: z.string().trim().optional(),
  date: dateKeyField,
  startTime: timeField,
  durationMinutes: z.coerce.number().int().min(10).max(240).optional(),
  reason: optionalText(200, "Randevu nedeni"),
  /** true: çalışma saati / slot hizalaması kontrolünü atla (çakışma kontrolü her zaman yapılır) */
  overrideSchedule: z.boolean().optional(),
  confirmNow: z.boolean().optional(),
});
export type AdminAppointmentInput = z.infer<typeof adminAppointmentSchema>;

export const rescheduleSchema = z.object({
  appointmentId: idField,
  dentistId: idField,
  date: dateKeyField,
  startTime: timeField,
  durationMinutes: z.coerce.number().int().min(10).max(240).optional(),
  overrideSchedule: z.boolean().optional(),
  note: optionalText(300, "Not"),
});
export type RescheduleInput = z.infer<typeof rescheduleSchema>;

export const confirmSchema = z.object({
  appointmentId: idField,
  /** Hasta eşleştirmesi: mevcut hastayı seç veya yeni hasta oluştur */
  patientId: z.string().trim().optional(),
  createNewPatient: z.boolean().optional(),
  note: optionalText(300, "Not"),
});
export type ConfirmInput = z.infer<typeof confirmSchema>;

export const statusReasonSchema = z.object({
  appointmentId: idField,
  reason: z.string().trim().max(300, "Açıklama en fazla 300 karakter olabilir.").optional(),
});

export const appointmentNoteSchema = z.object({
  appointmentId: idField,
  body: z.string().trim().min(1, "Not boş olamaz.").max(2000, "Not en fazla 2000 karakter olabilir."),
});

export const appointmentFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.string().optional(),
  dentistId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
});
export type AppointmentFilters = z.infer<typeof appointmentFiltersSchema>;
