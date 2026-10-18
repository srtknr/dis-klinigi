import { z } from "zod";
import { dateKeyField, idField, nameField, timeField } from "@/lib/validations/common";
import { hhmmToMinutes } from "@/lib/time";

export const dentistSchema = z.object({
  title: z.string().trim().min(1, "Unvan girin.").max(30),
  firstName: nameField("Ad"),
  lastName: nameField("Soyad"),
  specialty: z.string().trim().min(2, "Uzmanlık alanını girin.").max(120),
  bio: z.string().trim().max(2000, "Biyografi en fazla 2000 karakter olabilir.").optional(),
  slotMinutes: z.coerce.number().int().min(10, "En az 10 dakika.").max(240, "En fazla 240 dakika."),
  isActive: z.boolean(),
  acceptsOnlineBooking: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});
export type DentistInput = z.infer<typeof dentistSchema>;

export const dentistUpdateSchema = dentistSchema.extend({ dentistId: idField });

const dayRow = z
  .object({
    weekday: z.number().int().min(1).max(7),
    enabled: z.boolean(),
    start: timeField,
    end: timeField,
    breakStart: z.string().optional(),
    breakEnd: z.string().optional(),
  })
  .superRefine((row, ctx) => {
    if (!row.enabled) return;
    const s = hhmmToMinutes(row.start)!;
    const e = hhmmToMinutes(row.end)!;
    if (e <= s) ctx.addIssue({ code: "custom", path: ["end"], message: "Bitiş saati başlangıçtan sonra olmalı." });
    const bs = row.breakStart ? hhmmToMinutes(row.breakStart) : null;
    const be = row.breakEnd ? hhmmToMinutes(row.breakEnd) : null;
    if ((bs === null) !== (be === null)) {
      ctx.addIssue({ code: "custom", path: ["breakEnd"], message: "Mola için başlangıç ve bitiş birlikte girilmeli." });
    } else if (bs !== null && be !== null && (bs < s || be > e || be <= bs)) {
      ctx.addIssue({ code: "custom", path: ["breakEnd"], message: "Mola, çalışma saatleri içinde olmalı." });
    }
  });

export const workingHoursSchema = z.object({
  dentistId: idField,
  days: z.array(dayRow).length(7),
});
export type WorkingHoursInput = z.infer<typeof workingHoursSchema>;

export const blockedTimeSchema = z
  .object({
    dentistId: idField,
    type: z.enum(["LEAVE", "BREAK", "OTHER"]),
    startDate: dateKeyField,
    endDate: dateKeyField,
    allDay: z.boolean(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Bitiş tarihi başlangıçtan önce olamaz." });
    }
    if (!v.allDay) {
      const s = v.startTime ? hhmmToMinutes(v.startTime) : null;
      const e = v.endTime ? hhmmToMinutes(v.endTime) : null;
      if (s === null) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Başlangıç saatini girin." });
      if (e === null) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Bitiş saatini girin." });
      if (s !== null && e !== null && v.startDate === v.endDate && e <= s) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "Bitiş saati başlangıçtan sonra olmalı." });
      }
    }
  });
export type BlockedTimeInput = z.infer<typeof blockedTimeSchema>;
