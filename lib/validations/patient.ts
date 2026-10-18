import { z } from "zod";
import { dateKeyField, idField, nameField, optionalEmailField, phoneField } from "@/lib/validations/common";

export const patientSchema = z.object({
  firstName: nameField("Ad"),
  lastName: nameField("Soyad"),
  phone: phoneField,
  email: optionalEmailField,
  birthDate: z.union([z.literal(""), dateKeyField]).optional(),
  /** Aynı telefonla kayıtlı hasta varsa kullanıcının bilinçli onayı */
  confirmDuplicate: z.boolean().optional(),
});
export type PatientInput = z.infer<typeof patientSchema>;

export const patientUpdateSchema = patientSchema.extend({ patientId: idField });
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;

export const patientNoteSchema = z.object({
  patientId: idField,
  body: z.string().trim().min(1, "Not boş olamaz.").max(2000, "Not en fazla 2000 karakter olabilir."),
});
