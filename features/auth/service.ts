import "server-only";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { createSessionRecord } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations/staff";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const INVALID_CREDENTIALS = "E-posta adresi veya şifre hatalı.";

export async function loginWithPassword(
  raw: unknown,
  meta: { ip: string; ipHash: string | null; userAgent: string | null },
): Promise<{ token: string; expiresAt: Date }> {
  const input = loginSchema.parse(raw);

  const [byIp, byEmail] = await Promise.all([
    rateLimit("login-ip", meta.ip, 30, 15 * 60),
    rateLimit("login-email", input.email, 10, 15 * 60),
  ]);
  if (!byIp.ok || !byEmail.ok) throw errors.rateLimited();

  const user = await db.user.findUnique({
    where: { email: input.email },
    include: { memberships: { where: { isActive: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!user) {
    await verifyAgainstDummy(input.password);
    throw errors.validation(INVALID_CREDENTIALS);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw errors.validation(`Çok sayıda hatalı deneme nedeniyle hesap geçici olarak kilitlendi. ${LOCK_MINUTES} dakika sonra tekrar deneyin.`);
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed >= MAX_FAILED ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await writeAudit(db, {
      clinicId: user.memberships[0]?.clinicId ?? null,
      action: "auth.login_failed",
      entityType: "User",
      entityId: user.id,
      ipHash: meta.ipHash,
    });
    throw errors.validation(INVALID_CREDENTIALS);
  }

  if (!user.isActive || user.memberships.length === 0) {
    throw errors.validation("Hesabınız aktif değil. Lütfen klinik yöneticinizle iletişime geçin.");
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  const clinicId = user.memberships[0]!.clinicId;
  const session = await createSessionRecord({ userId: user.id, clinicId, userAgent: meta.userAgent });
  await writeAudit(db, { clinicId, ctx: { userId: user.id, clinicId }, action: "auth.login", entityType: "User", entityId: user.id, ipHash: meta.ipHash });
  return session;
}
