import "server-only";
import { db } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { effectivePermissions } from "@/lib/permissions";
import type { AuthContext } from "@/lib/auth/types";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-dk_session" : "dk_session";

/** Hareketsizlik süresi: bu sürede istek gelmezse oturum düşer */
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
/** Mutlak oturum süresi */
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export async function createSessionRecord(input: {
  userId: string;
  clinicId: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_IDLE_MS);
  await db.session.create({
    data: {
      tokenHash: sha256Hex(token),
      userId: input.userId,
      activeClinicId: input.clinicId,
      userAgent: input.userAgent?.slice(0, 255) ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

/**
 * Çerezdeki token'ı doğrular; kullanıcı ve klinik üyeliği aktif değilse null döner.
 * Pasif yapılan personelin erişimi bir sonraki istekte sona erer.
 */
export async function resolveSession(token: string | undefined | null): Promise<AuthContext | null> {
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: {
      user: {
        include: {
          memberships: { where: { isActive: true }, include: { clinic: { select: { id: true, name: true } } } },
          dentistProfile: { select: { id: true, clinicId: true } },
        },
      },
    },
  });
  if (!session) return null;

  const now = Date.now();
  const absoluteExpired = session.createdAt.getTime() + SESSION_ABSOLUTE_MS < now;
  if (session.expiresAt.getTime() < now || absoluteExpired || !session.user.isActive) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const memberships = session.user.memberships;
  const membership =
    memberships.find((m) => m.clinicId === session.activeClinicId) ?? memberships[0] ?? null;
  if (!membership) return null;

  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_IDLE_MS) },
      })
      .catch(() => undefined);
  }

  const dentist = session.user.dentistProfile;
  return {
    userId: session.user.id,
    sessionId: session.id,
    clinicId: membership.clinicId,
    clinicName: membership.clinic.name,
    role: membership.role,
    permissions: effectivePermissions(membership.role, membership.permissions),
    userName: session.user.name,
    email: session.user.email,
    dentistProfileId: dentist && dentist.clinicId === membership.clinicId ? dentist.id : null,
  };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: sha256Hex(token) } });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
