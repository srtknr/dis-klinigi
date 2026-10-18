"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { runAction } from "@/lib/actions";
import { writeAudit } from "@/lib/audit";
import { clearSessionCookie, getAuthContext, setSessionCookie } from "@/lib/auth/current";
import { revokeSessionByToken } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { clientIpHash, getClientIp } from "@/lib/rate-limit";
import { loginWithPassword } from "@/features/auth/service";

export async function loginAction(input: unknown) {
  return runAction(async () => {
    const h = await headers();
    const session = await loginWithPassword(input, {
      ip: getClientIp(h),
      ipHash: clientIpHash(h),
      userAgent: h.get("user-agent"),
    });
    await setSessionCookie(session.token, session.expiresAt);
    return { ok: true };
  });
}

export async function logoutAction() {
  const ctx = await getAuthContext();
  const token = await clearSessionCookie();
  if (token) await revokeSessionByToken(token);
  if (ctx) await writeAudit(db, { ctx, action: "auth.logout", entityType: "User", entityId: ctx.userId });
  redirect("/giris");
}
