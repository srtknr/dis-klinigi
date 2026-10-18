import { z } from "zod";
import { dateKeyField, idField } from "@/lib/validations/common";

const longText = (label: string, max = 4000) =>
  z.string().trim().max(max, `${label} en fazla ${max} karakter olabilir.`).optional();

export const treatmentRecordSchema = z.object({
  patientId: idField,
  dentistId: z.string().trim().min(1, "İlgili doktoru seçin."),
  appointmentId: z.string().trim().optional(),
  visitDate: dateKeyField,
  procedure: z.string().trim().min(2, "Yapılan işlemi girin.").max(300, "İşlem en fazla 300 karakter olabilir."),
  examinationNote: longText("Muayene notu"),
  nextVisitPlan: longText("Sonraki ziyaret", 300),
  nextVisitTodo: longText("Sonraki randevuda yapılacaklar", 1000),
});
export type TreatmentRecordInput = z.infer<typeof treatmentRecordSchema>;

export const treatmentUpdateSchema = treatmentRecordSchema.omit({ patientId: true }).extend({
  recordId: idField,
  changeReason: z
    .string()
    .trim()
    .min(5, "Düzeltme nedenini en az 5 karakterle açıklayın.")
    .max(300, "Düzeltme nedeni en fazla 300 karakter olabilir."),
});
export type TreatmentUpdateInput = z.infer<typeof treatmentUpdateSchema>;

export const treatmentVoidSchema = z.object({
  recordId: idField,
  reason: z.string().trim().min(5, "Geçersiz kılma nedenini açıklayın.").max(300),
});
