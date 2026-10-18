import type { PermissionKey, RoleKey } from "@/lib/permissions";

/**
 * Sunucu tarafında her iş kuralına aktarılan kimlik ve yetki bağlamı.
 * clinicId tüm sorgularda kapsam (tenant) filtresi olarak kullanılır.
 */
export type AuthContext = {
  userId: string;
  sessionId: string;
  clinicId: string;
  clinicName: string;
  role: RoleKey;
  permissions: PermissionKey[];
  userName: string;
  email: string;
  dentistProfileId: string | null;
};
