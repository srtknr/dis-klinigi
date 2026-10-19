import "server-only";
import { writeAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/types";
import { encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { errors } from "@/lib/errors";
import { describeWhatsappSetup } from "@/lib/notifications/config";
import { assertCan } from "@/lib/permissions/guard";
import { whatsappConfigSchema } from "@/lib/validations/whatsapp";

/** Token asla istemciye dönmez; yalnızca kayıtlı olup olmadığı bilgisi verilir. */
export async function getWhatsappOverview(ctx: AuthContext) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const config = await db.clinicWhatsappConfig.findUnique({
    where: { clinicId: ctx.clinicId },
    select: { phoneNumberId: true, wabaId: true, templateName: true, templateLanguage: true, isEnabled: true, lastError: true, updatedAt: true },
  });
  const [sent, failed, yes, no] = await Promise.all([
    db.notificationLog.count({ where: { clinicId: ctx.clinicId, channel: "WHATSAPP", status: "SENT" } }),
    db.notificationLog.count({ where: { clinicId: ctx.clinicId, channel: "WHATSAPP", status: "FAILED" } }),
    db.appointment.count({ where: { clinicId: ctx.clinicId, attendanceResponse: "YES", startsAt: { gte: new Date() } } }),
    db.appointment.count({ where: { clinicId: ctx.clinicId, attendanceResponse: "NO", startsAt: { gte: new Date() } } }),
  ]);
  return { config, setup: describeWhatsappSetup(), stats: { sent, failed, yes, no } };
}

export async function saveWhatsappConfig(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const input = whatsappConfigSchema.parse(raw);
  const existing = await db.clinicWhatsappConfig.findUnique({ where: { clinicId: ctx.clinicId }, select: { id: true } });
  if (!existing && !input.accessToken) {
    throw errors.validation("İlk kurulumda erişim token'ı zorunludur.", { accessToken: ["Erişim token'ı girin."] });
  }
  const taken = await db.clinicWhatsappConfig.findFirst({
    where: { phoneNumberId: input.phoneNumberId, NOT: { clinicId: ctx.clinicId } },
    select: { id: true },
  });
  if (taken) throw errors.conflict("Bu telefon numarası kimliği başka bir klinikte kullanılıyor.");

  const data = {
    phoneNumberId: input.phoneNumberId,
    wabaId: input.wabaId || null,
    templateName: input.templateName,
    templateLanguage: input.templateLanguage,
    isEnabled: input.isEnabled,
    lastError: null,
    updatedById: ctx.userId,
    ...(input.accessToken ? { accessTokenEnc: encryptSecret(input.accessToken) } : {}),
  };
  await db.clinicWhatsappConfig.upsert({
    where: { clinicId: ctx.clinicId },
    update: data,
    create: { ...data, clinicId: ctx.clinicId, accessTokenEnc: encryptSecret(input.accessToken!) },
  });
  // Token değeri denetim kaydına yazılmaz
  await writeAudit(db, {
    ctx,
    action: "whatsapp.config_saved",
    entityType: "ClinicWhatsappConfig",
    entityId: ctx.clinicId,
    metadata: { enabled: input.isEnabled, tokenChanged: Boolean(input.accessToken) },
  });
  return { ok: true };
}
