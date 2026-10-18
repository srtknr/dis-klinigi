import { z } from "zod";
import { normalizeTrPhone } from "@/lib/phone";
import { hhmmToMinutes, isDateKey } from "@/lib/time";

export const idField = z.string().trim().min(1).max(64);

export const nameField = (label: string) =>
  z
    .string({ error: `${label} zorunludur.` })
    .trim()
    .min(2, `${label} en az 2 karakter olmalıdır.`)
    .max(60, `${label} en fazla 60 karakter olabilir.`)
    .regex(/^[\p{L}][\p{L}\s'.-]*$/u, `${label} yalnızca harf içermelidir.`);

export const phoneField = z
  .string({ error: "Telefon numarası zorunludur." })
  .trim()
  .min(1, "Telefon numarası zorunludur.")
  .refine((v) => normalizeTrPhone(v) !== null, "Geçerli bir telefon numarası girin (ör. 0555 123 45 67).");

export const optionalEmailField = z
  .string()
  .trim()
  .max(120, "E-posta adresi çok uzun.")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Geçerli bir e-posta adresi girin.")
  .optional();

export const dateKeyField = z
  .string({ error: "Tarih seçin." })
  .refine((v) => isDateKey(v), "Geçerli bir tarih seçin.");

export const timeField = z
  .string({ error: "Saat seçin." })
  .refine((v) => hhmmToMinutes(v) !== null, "Geçerli bir saat seçin (SS:DD).");

export const optionalText = (max: number, label = "Bu alan") =>
  z.string().trim().max(max, `${label} en fazla ${max} karakter olabilir.`).optional();

export const passwordField = z
  .string()
  .min(10, "Şifre en az 10 karakter olmalıdır.")
  .max(128, "Şifre çok uzun.")
  .regex(/[A-Za-zÇĞİÖŞÜçğıöşü]/, "Şifre en az bir harf içermelidir.")
  .regex(/\d/, "Şifre en az bir rakam içermelidir.");

/** Boş string'i undefined'a çevirir (opsiyonel select alanları için) */
export function emptyToUndefined(value: string | undefined | null): string | undefined {
  return value && value.trim() !== "" ? value.trim() : undefined;
}
