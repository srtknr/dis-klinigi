import { Permission, Role } from "@/generated/prisma/enums";

export { Permission, Role };
export type PermissionKey = (typeof Permission)[keyof typeof Permission];
export type RoleKey = (typeof Role)[keyof typeof Role];

export const ROLE_LABELS: Record<RoleKey, string> = {
  OWNER: "Klinik Sahibi",
  DENTIST: "Hekim",
  EDITOR: "Editör",
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  APPOINTMENT_VIEW: "Randevuları görüntüleme",
  APPOINTMENT_CREATE: "Randevu oluşturma",
  APPOINTMENT_EDIT: "Randevu düzenleme (iptal, yeniden planlama, tamamlama, not)",
  APPOINTMENT_APPROVE: "Randevu onaylama / reddetme",
  PATIENT_VIEW: "Hasta kayıtlarını görüntüleme",
  PATIENT_MANAGE: "Hasta kaydı oluşturma ve düzenleme",
  TREATMENT_VIEW: "Muayene notlarını görüntüleme",
  TREATMENT_MANAGE: "Muayene notu oluşturma ve düzenleme",
  DENTIST_VIEW: "Doktor ve çalışma saatlerini görüntüleme",
  DENTIST_MANAGE: "Doktor ve çalışma saatlerini yönetme",
  STAFF_MANAGE: "Çalışan ve yetki yönetimi",
  SETTINGS_MANAGE: "Klinik ayarları ve entegrasyonlar",
  AUDIT_VIEW: "Denetim kayıtlarını görüntüleme",
};

export const PERMISSION_GROUPS: { title: string; permissions: PermissionKey[] }[] = [
  {
    title: "Randevular",
    permissions: ["APPOINTMENT_VIEW", "APPOINTMENT_CREATE", "APPOINTMENT_EDIT", "APPOINTMENT_APPROVE"],
  },
  { title: "Hastalar", permissions: ["PATIENT_VIEW", "PATIENT_MANAGE"] },
  { title: "Muayene kayıtları", permissions: ["TREATMENT_VIEW", "TREATMENT_MANAGE"] },
  { title: "Doktorlar", permissions: ["DENTIST_VIEW", "DENTIST_MANAGE"] },
];

/** Yalnızca OWNER rolüne ait, başka rollere atanamayan izinler */
export const OWNER_ONLY_PERMISSIONS: PermissionKey[] = ["STAFF_MANAGE", "SETTINGS_MANAGE", "AUDIT_VIEW"];

export const ALL_PERMISSIONS = Object.values(Permission) as PermissionKey[];

export const ASSIGNABLE_PERMISSIONS = ALL_PERMISSIONS.filter((p) => !OWNER_ONLY_PERMISSIONS.includes(p));

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  OWNER: ALL_PERMISSIONS,
  DENTIST: [
    "APPOINTMENT_VIEW",
    "APPOINTMENT_CREATE",
    "APPOINTMENT_EDIT",
    "APPOINTMENT_APPROVE",
    "PATIENT_VIEW",
    "PATIENT_MANAGE",
    "TREATMENT_VIEW",
    "TREATMENT_MANAGE",
    "DENTIST_VIEW",
  ],
  EDITOR: ["APPOINTMENT_VIEW", "APPOINTMENT_CREATE", "PATIENT_VIEW", "DENTIST_VIEW"],
};

/** Rol + saklanan izinlerden etkin izin kümesini hesaplar. OWNER her zaman tüm izinlere sahiptir. */
export function effectivePermissions(role: RoleKey, stored: readonly PermissionKey[]): PermissionKey[] {
  if (role === "OWNER") return [...ALL_PERMISSIONS];
  return stored.filter((p) => !OWNER_ONLY_PERMISSIONS.includes(p));
}

/** Atanmak istenen izinleri role göre temizler (OWNER-only izinler başka rollere verilemez). */
export function sanitizePermissions(role: RoleKey, requested: readonly PermissionKey[]): PermissionKey[] {
  if (role === "OWNER") return [];
  const unique = Array.from(new Set(requested));
  return unique.filter((p) => ASSIGNABLE_PERMISSIONS.includes(p));
}

export type PermissionHolder = { role: RoleKey; permissions: readonly PermissionKey[] };

export function can(holder: PermissionHolder | null | undefined, permission: PermissionKey): boolean {
  if (!holder) return false;
  if (holder.role === "OWNER") return true;
  return holder.permissions.includes(permission);
}

export function canAll(holder: PermissionHolder | null | undefined, permissions: PermissionKey[]): boolean {
  return permissions.every((p) => can(holder, p));
}
