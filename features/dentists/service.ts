import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/types";
import { randomToken } from "@/lib/crypto";
import { errors } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/guard";
import { slugify } from "@/lib/text";
import { addDaysToKey, hhmmToMinutes, zonedTimeToUtc } from "@/lib/time";
import { emptyToUndefined } from "@/lib/validations/common";
import { blockedTimeSchema, dentistSchema, dentistUpdateSchema, workingHoursSchema } from "@/lib/validations/dentist";

export async function listDentists(ctx: AuthContext) {
  assertCan(ctx, "DENTIST_VIEW");
  return db.dentistProfile.findMany({
    where: { clinicId: ctx.clinicId },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { lastName: "asc" }],
    include: { workingHours: { orderBy: { weekday: "asc" } }, user: { select: { name: true, email: true } } },
  });
}

/** Seçim listeleri için hafif liste (randevu oluşturma, filtreler) */
export async function listDentistOptions(ctx: AuthContext) {
  assertCan(ctx, "APPOINTMENT_VIEW");
  const rows = await db.dentistProfile.findMany({
    where: { clinicId: ctx.clinicId },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
    select: { id: true, title: true, firstName: true, lastName: true, isActive: true, slotMinutes: true },
  });
  return rows.map((d) => ({
    id: d.id,
    name: `${d.title} ${d.firstName} ${d.lastName}`,
    isActive: d.isActive,
    slotMinutes: d.slotMinutes,
  }));
}

export async function getDentistDetail(ctx: AuthContext, dentistId: string, now = new Date()) {
  assertCan(ctx, "DENTIST_VIEW");
  const dentist = await db.dentistProfile.findFirst({
    where: { id: dentistId, clinicId: ctx.clinicId },
    include: {
      workingHours: { orderBy: { weekday: "asc" } },
      blockedTimes: { where: { endsAt: { gte: now } }, orderBy: { startsAt: "asc" } },
      calendarConnections: { select: { id: true, status: true, googleEmail: true } },
    },
  });
  if (!dentist) throw errors.notFound("Doktor");
  return dentist;
}

async function uniqueSlug(clinicId: string, base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "doktor";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const exists = await db.dentistProfile.findFirst({
      where: { clinicId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!exists) return slug;
  }
  return `${root}-${randomToken(3).toLowerCase()}`;
}

export async function createDentist(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "DENTIST_MANAGE");
  const input = dentistSchema.parse(raw);
  const slug = await uniqueSlug(ctx.clinicId, `${input.firstName} ${input.lastName}`);
  return db.$transaction(async (tx) => {
    const dentist = await tx.dentistProfile.create({
      data: {
        clinicId: ctx.clinicId,
        slug,
        title: input.title,
        firstName: input.firstName,
        lastName: input.lastName,
        specialty: input.specialty,
        bio: emptyToUndefined(input.bio) ?? null,
        slotMinutes: input.slotMinutes,
        isActive: input.isActive,
        acceptsOnlineBooking: input.acceptsOnlineBooking,
        sortOrder: input.sortOrder ?? 0,
        // Varsayılan program: hafta içi 09:00–18:00, 12:30–13:30 mola
        workingHours: {
          create: [1, 2, 3, 4, 5].map((weekday) => ({
            weekday,
            startMinute: 9 * 60,
            endMinute: 18 * 60,
            breakStartMinute: 12 * 60 + 30,
            breakEndMinute: 13 * 60 + 30,
          })),
        },
      },
    });
    await writeAudit(tx, { ctx, action: "dentist.created", entityType: "DentistProfile", entityId: dentist.id });
    return { dentistId: dentist.id };
  });
}

export async function updateDentist(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "DENTIST_MANAGE");
  const input = dentistUpdateSchema.parse(raw);
  const existing = await db.dentistProfile.findFirst({ where: { id: input.dentistId, clinicId: ctx.clinicId } });
  if (!existing) throw errors.notFound("Doktor");
  const nameChanged = existing.firstName !== input.firstName || existing.lastName !== input.lastName;
  const slug = nameChanged ? await uniqueSlug(ctx.clinicId, `${input.firstName} ${input.lastName}`, existing.id) : existing.slug;
  await db.$transaction(async (tx) => {
    await tx.dentistProfile.update({
      where: { id: existing.id },
      data: {
        slug,
        title: input.title,
        firstName: input.firstName,
        lastName: input.lastName,
        specialty: input.specialty,
        bio: emptyToUndefined(input.bio) ?? null,
        slotMinutes: input.slotMinutes,
        isActive: input.isActive,
        acceptsOnlineBooking: input.acceptsOnlineBooking,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      },
    });
    await writeAudit(tx, {
      ctx,
      action: "dentist.updated",
      entityType: "DentistProfile",
      entityId: existing.id,
      metadata: { isActive: input.isActive, acceptsOnlineBooking: input.acceptsOnlineBooking },
    });
  });
  return { dentistId: existing.id };
}

export async function setWorkingHours(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "DENTIST_MANAGE");
  const input = workingHoursSchema.parse(raw);
  const dentist = await db.dentistProfile.findFirst({ where: { id: input.dentistId, clinicId: ctx.clinicId }, select: { id: true } });
  if (!dentist) throw errors.notFound("Doktor");
  await db.$transaction(async (tx) => {
    await tx.workingHour.deleteMany({ where: { dentistId: dentist.id } });
    const rows = input.days
      .filter((d) => d.enabled)
      .map((d) => ({
        dentistId: dentist.id,
        weekday: d.weekday,
        startMinute: hhmmToMinutes(d.start)!,
        endMinute: hhmmToMinutes(d.end)!,
        breakStartMinute: d.breakStart ? hhmmToMinutes(d.breakStart) : null,
        breakEndMinute: d.breakEnd ? hhmmToMinutes(d.breakEnd) : null,
      }));
    if (rows.length) await tx.workingHour.createMany({ data: rows });
    await writeAudit(tx, {
      ctx,
      action: "dentist.schedule_updated",
      entityType: "DentistProfile",
      entityId: dentist.id,
      metadata: { workingDays: rows.map((r) => r.weekday) },
    });
  });
  return { dentistId: dentist.id };
}

export async function addBlockedTime(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "DENTIST_MANAGE");
  const input = blockedTimeSchema.parse(raw);
  const dentist = await db.dentistProfile.findFirst({ where: { id: input.dentistId, clinicId: ctx.clinicId }, select: { id: true } });
  if (!dentist) throw errors.notFound("Doktor");
  const startsAt = input.allDay
    ? zonedTimeToUtc(input.startDate, 0)
    : zonedTimeToUtc(input.startDate, hhmmToMinutes(input.startTime!)!);
  const endsAt = input.allDay
    ? zonedTimeToUtc(addDaysToKey(input.endDate, 1), 0)
    : zonedTimeToUtc(input.endDate, hhmmToMinutes(input.endTime!)!);
  if (endsAt <= startsAt) throw errors.validation("Bitiş, başlangıçtan sonra olmalıdır.");

  const conflicting = await db.appointment.count({
    where: { dentistId: dentist.id, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  });
  const blocked = await db.blockedTime.create({
    data: {
      clinicId: ctx.clinicId,
      dentistId: dentist.id,
      type: input.type,
      startsAt,
      endsAt,
      reason: emptyToUndefined(input.reason) ?? null,
      createdById: ctx.userId,
    },
  });
  await writeAudit(db, { ctx, action: "dentist.blocked_time_added", entityType: "DentistProfile", entityId: dentist.id });
  return { blockedTimeId: blocked.id, conflictingAppointments: conflicting };
}

export async function removeBlockedTime(ctx: AuthContext, blockedTimeId: string) {
  assertCan(ctx, "DENTIST_MANAGE");
  const blocked = await db.blockedTime.findFirst({ where: { id: blockedTimeId, clinicId: ctx.clinicId } });
  if (!blocked) throw errors.notFound("Kayıt");
  await db.blockedTime.delete({ where: { id: blocked.id } });
  await writeAudit(db, { ctx, action: "dentist.blocked_time_removed", entityType: "DentistProfile", entityId: blocked.dentistId });
  return { dentistId: blocked.dentistId };
}

// ───── Profil fotoğrafı (geliştirme: yerel disk; üretim: nesne depolama önerilir) ─────

export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function detectImageType(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "webp";
  return null;
}

export async function saveDentistPhoto(ctx: AuthContext, dentistId: string, file: File | null) {
  assertCan(ctx, "DENTIST_MANAGE");
  const dentist = await db.dentistProfile.findFirst({ where: { id: dentistId, clinicId: ctx.clinicId } });
  if (!dentist) throw errors.notFound("Doktor");
  if (!file || file.size === 0) throw errors.validation("Bir fotoğraf seçin.");
  if (file.size > MAX_PHOTO_BYTES) throw errors.validation("Fotoğraf en fazla 2 MB olabilir.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectImageType(bytes);
  if (!ext) throw errors.validation("Yalnızca JPG, PNG veya WEBP fotoğraf yüklenebilir.");

  const dir = path.join(UPLOAD_ROOT, "dentists");
  await mkdir(dir, { recursive: true });
  const filename = `${dentist.id}-${randomToken(8)}.${ext}`;
  await writeFile(path.join(dir, filename), bytes);

  const previous = dentist.photoUrl?.startsWith("/media/dentists/") ? dentist.photoUrl.split("/").pop() : null;
  await db.dentistProfile.update({ where: { id: dentist.id }, data: { photoUrl: `/media/dentists/${filename}` } });
  if (previous) await unlink(path.join(dir, previous)).catch(() => undefined);
  await writeAudit(db, { ctx, action: "dentist.updated", entityType: "DentistProfile", entityId: dentist.id, metadata: { photo: true } });
  return { dentistId: dentist.id };
}
