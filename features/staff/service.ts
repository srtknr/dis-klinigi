import "server-only";
import { db, isUniqueViolation } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllUserSessions } from "@/lib/auth/session";
import type { AuthContext } from "@/lib/auth/types";
import { errors } from "@/lib/errors";
import { DEFAULT_ROLE_PERMISSIONS, sanitizePermissions, type PermissionKey } from "@/lib/permissions";
import { assertCan } from "@/lib/permissions/guard";
import { emptyToUndefined } from "@/lib/validations/common";
import { staffCreateSchema, staffPasswordSchema, staffUpdateSchema } from "@/lib/validations/staff";

export async function listStaff(ctx: AuthContext) {
  assertCan(ctx, "STAFF_MANAGE");
  return db.membership.findMany({
    where: { clinicId: ctx.clinicId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          lastLoginAt: true,
          dentistProfile: { select: { id: true, title: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { createdAt: "asc" }],
  });
}

export async function getStaffMember(ctx: AuthContext, membershipId: string) {
  assertCan(ctx, "STAFF_MANAGE");
  const membership = await db.membership.findFirst({
    where: { id: membershipId, clinicId: ctx.clinicId },
    include: { user: { select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true, dentistProfile: { select: { id: true } } } } },
  });
  if (!membership) throw errors.notFound("Çalışan");
  return membership;
}

async function linkDentistProfile(clinicId: string, userId: string, dentistProfileId: string | undefined) {
  if (!dentistProfileId) {
    await db.dentistProfile.updateMany({ where: { clinicId, userId }, data: { userId: null } });
    return;
  }
  const profile = await db.dentistProfile.findFirst({ where: { id: dentistProfileId, clinicId } });
  if (!profile) throw errors.validation("Doktor profili bulunamadı.");
  if (profile.userId && profile.userId !== userId) throw errors.validation("Bu doktor profili başka bir kullanıcıya bağlı.");
  await db.dentistProfile.updateMany({ where: { clinicId, userId, id: { not: profile.id } }, data: { userId: null } });
  await db.dentistProfile.update({ where: { id: profile.id }, data: { userId } });
}

async function assertNotLastOwner(clinicId: string, membershipId: string) {
  const owners = await db.membership.count({ where: { clinicId, role: "OWNER", isActive: true, id: { not: membershipId } } });
  if (owners === 0) throw errors.invalidState("Klinikte en az bir aktif klinik sahibi (OWNER) bulunmalıdır.");
}

export async function createStaff(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "STAFF_MANAGE");
  const input = staffCreateSchema.parse(raw);
  const permissions = sanitizePermissions(input.role, input.permissions as PermissionKey[]);

  const existingUser = await db.user.findUnique({ where: { email: input.email }, include: { memberships: true } });
  if (existingUser?.memberships.some((m) => m.clinicId === ctx.clinicId)) {
    throw errors.validation("Bu e-posta adresiyle kayıtlı bir çalışan zaten var.", { email: ["Bu e-posta kullanımda."] });
  }
  if (existingUser) {
    // Başka klinikte hesabı olan kullanıcının şifresi bu klinik tarafından değiştirilemez
    throw errors.validation("Bu e-posta adresi başka bir hesapta kullanılıyor. Farklı bir e-posta adresi girin.", {
      email: ["Bu e-posta kullanımda."],
    });
  }

  try {
    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        memberships: {
          create: {
            clinicId: ctx.clinicId,
            role: input.role,
            permissions: input.role === "OWNER" ? [] : permissions.length ? permissions : DEFAULT_ROLE_PERMISSIONS[input.role],
          },
        },
      },
      include: { memberships: true },
    });
    await linkDentistProfile(ctx.clinicId, user.id, emptyToUndefined(input.dentistProfileId));
    await writeAudit(db, {
      ctx,
      action: "staff.created",
      entityType: "Membership",
      entityId: user.memberships[0]!.id,
      metadata: { role: input.role, permissions },
    });
    return { membershipId: user.memberships[0]!.id };
  } catch (error) {
    if (isUniqueViolation(error)) throw errors.validation("Bu e-posta adresi kullanımda.", { email: ["Bu e-posta kullanımda."] });
    throw error;
  }
}

export async function updateStaff(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "STAFF_MANAGE");
  const input = staffUpdateSchema.parse(raw);
  const membership = await db.membership.findFirst({ where: { id: input.membershipId, clinicId: ctx.clinicId } });
  if (!membership) throw errors.notFound("Çalışan");

  const losingOwner = membership.role === "OWNER" && (input.role !== "OWNER" || !input.isActive);
  if (losingOwner) await assertNotLastOwner(ctx.clinicId, membership.id);
  if (membership.userId === ctx.userId && !input.isActive) {
    throw errors.invalidState("Kendi erişiminizi pasif yapamazsınız.");
  }

  const permissions = sanitizePermissions(input.role, input.permissions as PermissionKey[]);
  await db.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membership.id },
      data: { role: input.role, permissions, isActive: input.isActive },
    });
    await tx.user.update({ where: { id: membership.userId }, data: { name: input.name } });
    await writeAudit(tx, {
      ctx,
      action: "staff.updated",
      entityType: "Membership",
      entityId: membership.id,
      metadata: { role: input.role, permissions, isActive: input.isActive },
    });
  });
  await linkDentistProfile(ctx.clinicId, membership.userId, emptyToUndefined(input.dentistProfileId));
  // Yetki daraltıldığında veya erişim kapatıldığında açık oturumlar sonlandırılır
  if (!input.isActive || input.role !== membership.role) await revokeAllUserSessions(membership.userId);
  return { membershipId: membership.id };
}

export async function resetStaffPassword(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "STAFF_MANAGE");
  const input = staffPasswordSchema.parse(raw);
  const membership = await db.membership.findFirst({ where: { id: input.membershipId, clinicId: ctx.clinicId } });
  if (!membership) throw errors.notFound("Çalışan");
  const otherClinics = await db.membership.count({ where: { userId: membership.userId, clinicId: { not: ctx.clinicId } } });
  if (otherClinics > 0) throw errors.forbidden();
  await db.user.update({
    where: { id: membership.userId },
    data: { passwordHash: await hashPassword(input.password), failedLoginCount: 0, lockedUntil: null },
  });
  await revokeAllUserSessions(membership.userId);
  await writeAudit(db, { ctx, action: "staff.password_reset", entityType: "Membership", entityId: membership.id });
  return { membershipId: membership.id };
}

/** Erişimi tamamen kaldırır: klinik üyeliği silinir, oturumlar sonlandırılır. Geçmiş kayıtlar korunur. */
export async function removeStaffAccess(ctx: AuthContext, membershipId: string) {
  assertCan(ctx, "STAFF_MANAGE");
  const membership = await db.membership.findFirst({ where: { id: membershipId, clinicId: ctx.clinicId } });
  if (!membership) throw errors.notFound("Çalışan");
  if (membership.userId === ctx.userId) throw errors.invalidState("Kendi erişiminizi kaldıramazsınız.");
  if (membership.role === "OWNER") await assertNotLastOwner(ctx.clinicId, membership.id);
  await db.$transaction(async (tx) => {
    await tx.dentistProfile.updateMany({ where: { clinicId: ctx.clinicId, userId: membership.userId }, data: { userId: null } });
    await tx.membership.delete({ where: { id: membership.id } });
    await writeAudit(tx, { ctx, action: "staff.access_removed", entityType: "Membership", entityId: membership.id });
  });
  await revokeAllUserSessions(membership.userId);
  return { ok: true };
}
