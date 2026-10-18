import "server-only";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/types";
import { errors } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/guard";
import { slugify } from "@/lib/text";
import { emptyToUndefined } from "@/lib/validations/common";
import { clinicSchema, serviceSchema } from "@/lib/validations/clinic";

export async function getClinicSettings(ctx: AuthContext) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const clinic = await db.clinic.findUnique({
    where: { id: ctx.clinicId },
    include: { services: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  if (!clinic) throw errors.notFound("Klinik");
  return clinic;
}

export async function updateClinic(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const input = clinicSchema.parse(raw);
  const n = (v?: string) => emptyToUndefined(v) ?? null;
  await db.clinic.update({
    where: { id: ctx.clinicId },
    data: {
      name: input.name,
      tagline: n(input.tagline),
      about: n(input.about),
      phone: n(input.phone),
      email: n(input.email),
      notificationEmail: n(input.notificationEmail),
      address: n(input.address),
      city: n(input.city),
      workingHoursText: n(input.workingHoursText),
      mapEmbedUrl: n(input.mapEmbedUrl),
    },
  });
  await writeAudit(db, { ctx, action: "clinic.updated", entityType: "Clinic", entityId: ctx.clinicId });
  return { ok: true };
}

export async function upsertService(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const input = serviceSchema.parse(raw);
  const data = {
    name: input.name,
    description: emptyToUndefined(input.description) ?? null,
    durationMinutes: input.durationMinutes ?? null,
    isActive: input.isActive,
    sortOrder: input.sortOrder ?? 0,
  };
  const serviceId = emptyToUndefined(input.serviceId);
  if (serviceId) {
    const existing = await db.service.findFirst({ where: { id: serviceId, clinicId: ctx.clinicId } });
    if (!existing) throw errors.notFound("Hizmet");
    await db.service.update({ where: { id: existing.id }, data });
    await writeAudit(db, { ctx, action: "service.updated", entityType: "Service", entityId: existing.id });
    return { serviceId: existing.id };
  }
  let slug = slugify(input.name) || "hizmet";
  if (await db.service.findFirst({ where: { clinicId: ctx.clinicId, slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const created = await db.service.create({ data: { ...data, clinicId: ctx.clinicId, slug } });
  await writeAudit(db, { ctx, action: "service.created", entityType: "Service", entityId: created.id });
  return { serviceId: created.id };
}

export async function listServiceOptions(ctx: AuthContext) {
  assertCan(ctx, "APPOINTMENT_VIEW");
  return db.service.findMany({
    where: { clinicId: ctx.clinicId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, durationMinutes: true },
  });
}
