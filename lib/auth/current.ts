import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession, SESSION_COOKIE } from "@/lib/auth/session";
import type { AuthContext } from "@/lib/auth/types";
import { errors } from "@/lib/errors";
import { can, type PermissionKey } from "@/lib/permissions";

/** İstek başına bir kez çözülen oturum bağlamı (Data Access Layer girişi) */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
});

/** Sayfalar için: oturum yoksa giriş sayfasına yönlendirir */
export async function requirePageAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/giris");
  return ctx;
}

/** Sayfalar için: izin yoksa yetkisiz sayfasına yönlendirir */
export async function requirePagePermission(...permissions: PermissionKey[]): Promise<AuthContext> {
  const ctx = await requirePageAuth();
  if (!permissions.every((p) => can(ctx, p))) redirect("/admin/yetkisiz");
  return ctx;
}

/** Server action / route handler için: oturum yoksa hata fırlatır */
export async function requireActionAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw errors.unauthenticated();
  return ctx;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Math.max(expiresAt.getTime(), Date.now() + 7 * 24 * 60 * 60 * 1000)),
  });
}

export async function clearSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  return token;
}
