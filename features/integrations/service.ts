import "server-only";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/types";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { errors } from "@/lib/errors";
import { getGoogleConfig, isGoogleConfigured } from "@/lib/google-calendar/config";
import { emailFromIdToken, exchangeCodeForTokens, revokeToken } from "@/lib/google-calendar/oauth";
import { describeNotificationSetup } from "@/lib/notifications/config";
import { dispatchNotification } from "@/lib/notifications/outbox";
import { processCalendarMapping } from "@/lib/google-calendar/sync";
import { assertCan } from "@/lib/permissions/guard";

export async function getIntegrationsOverview(ctx: AuthContext) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const [connections, dentists, failedSyncs, pendingSyncs] = await Promise.all([
    db.googleCalendarConnection.findMany({
      where: { clinicId: ctx.clinicId },
      include: { dentist: { select: { title: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.dentistProfile.findMany({
      where: { clinicId: ctx.clinicId, isActive: true },
      select: { id: true, title: true, firstName: true, lastName: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.calendarEventMapping.findMany({
      where: { syncStatus: "FAILED", connection: { clinicId: ctx.clinicId } },
      include: { appointment: { select: { id: true, startsAt: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.calendarEventMapping.count({ where: { syncStatus: { in: ["PENDING", "PROCESSING"] }, connection: { clinicId: ctx.clinicId } } }),
  ]);
  return {
    googleConfigured: isGoogleConfigured(),
    connections: connections.map(({ accessTokenEnc: _a, refreshTokenEnc: _r, ...safe }) => safe),
    dentists,
    failedSyncs,
    pendingSyncs,
    notifications: describeNotificationSetup(),
  };
}

/** OAuth callback: kod → token, şifreli saklama. Aynı kapsam için mevcut bağlantı güncellenir. */
export async function completeGoogleConnection(
  ctx: AuthContext,
  input: { code: string; codeVerifier: string; dentistId: string | null },
) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const config = getGoogleConfig();
  if (!config) throw errors.validation("Google OAuth yapılandırılmamış.");
  if (input.dentistId) {
    const dentist = await db.dentistProfile.findFirst({ where: { id: input.dentistId, clinicId: ctx.clinicId }, select: { id: true } });
    if (!dentist) throw errors.notFound("Doktor");
  }
  const tokens = await exchangeCodeForTokens(config, input.code, input.codeVerifier);
  if (!tokens.scope.includes("calendar.events")) {
    throw errors.validation("Takvim izni verilmedi. Bağlantı sırasında takvim erişimine izin vermeniz gerekir.");
  }
  const data = {
    googleEmail: emailFromIdToken(tokens.id_token),
    accessTokenEnc: encryptSecret(tokens.access_token),
    refreshTokenEnc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
    tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope,
    status: "ACTIVE" as const,
    lastError: null,
    connectedById: ctx.userId,
  };
  const existing = await db.googleCalendarConnection.findFirst({
    where: { clinicId: ctx.clinicId, dentistId: input.dentistId },
  });
  const connection = existing
    ? await db.googleCalendarConnection.update({
        where: { id: existing.id },
        data: { ...data, refreshTokenEnc: data.refreshTokenEnc ?? existing.refreshTokenEnc },
      })
    : await db.googleCalendarConnection.create({ data: { ...data, clinicId: ctx.clinicId, dentistId: input.dentistId } });
  await writeAudit(db, {
    ctx,
    action: "calendar.connected",
    entityType: "GoogleCalendarConnection",
    entityId: connection.id,
    metadata: { dentistId: input.dentistId },
  });
  return { connectionId: connection.id };
}

export async function disconnectGoogle(ctx: AuthContext, connectionId: string) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const connection = await db.googleCalendarConnection.findFirst({ where: { id: connectionId, clinicId: ctx.clinicId } });
  if (!connection) throw errors.notFound("Bağlantı");
  const token = connection.refreshTokenEnc ?? connection.accessTokenEnc;
  try {
    await revokeToken(decryptSecret(token));
  } catch {
    // Token çözülemese de bağlantı yerel olarak kaldırılır
  }
  await db.googleCalendarConnection.delete({ where: { id: connection.id } });
  await writeAudit(db, { ctx, action: "calendar.disconnected", entityType: "GoogleCalendarConnection", entityId: connection.id });
  return { ok: true };
}

export async function retryCalendarSync(ctx: AuthContext, mappingId: string) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const mapping = await db.calendarEventMapping.findFirst({ where: { id: mappingId, connection: { clinicId: ctx.clinicId } } });
  if (!mapping) throw errors.notFound("Senkronizasyon kaydı");
  await db.calendarEventMapping.update({
    where: { id: mapping.id },
    data: { syncStatus: "PENDING", nextAttemptAt: new Date(), attempts: 0 },
  });
  return { outcome: await processCalendarMapping(mapping.id) };
}

// ───── Bildirim kayıtları ─────

export async function listNotifications(ctx: AuthContext, params: { status?: string; page?: number }) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const page = params.page ?? 1;
  const statuses = ["PENDING", "PROCESSING", "SENT", "FAILED", "SKIPPED"] as const;
  const status = statuses.find((s) => s === params.status);
  const where = { clinicId: ctx.clinicId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    db.notificationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        channel: true,
        template: true,
        recipient: true,
        status: true,
        provider: true,
        attempts: true,
        lastError: true,
        sentAt: true,
        createdAt: true,
        nextAttemptAt: true,
        appointmentId: true,
      },
    }),
    db.notificationLog.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / 25)) };
}

export async function retryNotification(ctx: AuthContext, notificationId: string) {
  assertCan(ctx, "SETTINGS_MANAGE");
  const log = await db.notificationLog.findFirst({ where: { id: notificationId, clinicId: ctx.clinicId } });
  if (!log) throw errors.notFound("Bildirim");
  if (log.status === "SENT") throw errors.invalidState("Gönderilmiş bildirim yeniden gönderilemez.");
  await db.notificationLog.update({ where: { id: log.id }, data: { status: "PENDING", nextAttemptAt: new Date() } });
  await writeAudit(db, { ctx, action: "notification.retried", entityType: "NotificationLog", entityId: log.id });
  return { outcome: await dispatchNotification(log.id) };
}

export async function listAuditLogs(ctx: AuthContext, params: { page?: number; entityType?: string }) {
  assertCan(ctx, "AUDIT_VIEW");
  const page = params.page ?? 1;
  const where = { clinicId: ctx.clinicId, ...(params.entityType ? { entityType: params.entityType } : {}) };
  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 30,
      take: 30,
    }),
    db.auditLog.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / 30)) };
}
