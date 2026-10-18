import { z } from "zod";
import { Permission } from "@/generated/prisma/enums";
import { idField, passwordField } from "@/lib/validations/common";

const permissionEnum = z.enum(Object.values(Permission) as [string, ...string[]]);

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2, "Ad soyad girin.").max(80),
  email: z.email("Geçerli bir e-posta adresi girin.").trim().toLowerCase().max(120),
  password: passwordField,
  role: z.enum(["OWNER", "DENTIST", "EDITOR"]),
  permissions: z.array(permissionEnum).max(20),
  dentistProfileId: z.string().trim().optional(),
});
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;

export const staffUpdateSchema = z.object({
  membershipId: idField,
  name: z.string().trim().min(2, "Ad soyad girin.").max(80),
  role: z.enum(["OWNER", "DENTIST", "EDITOR"]),
  permissions: z.array(permissionEnum).max(20),
  isActive: z.boolean(),
  dentistProfileId: z.string().trim().optional(),
});
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;

export const staffPasswordSchema = z.object({
  membershipId: idField,
  password: passwordField,
});

export const loginSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi girin.").trim().toLowerCase().max(120),
  password: z.string().min(1, "Şifrenizi girin.").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;
