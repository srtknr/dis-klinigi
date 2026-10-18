import type { AuthContext } from "@/lib/auth/types";
import { errors } from "@/lib/errors";
import { can, type PermissionKey } from "@/lib/permissions";

/** İzin yoksa FORBIDDEN fırlatır. Tüm servis fonksiyonlarının ilk satırında kullanılır. */
export function assertCan(ctx: AuthContext, ...permissions: PermissionKey[]): void {
  for (const permission of permissions) {
    if (!can(ctx, permission)) throw errors.forbidden();
  }
}

export function assertOwner(ctx: AuthContext): void {
  if (ctx.role !== "OWNER") throw errors.forbidden();
}
