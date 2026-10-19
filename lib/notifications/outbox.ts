import "server-only";
import { db, type Tx } from "@/lib/db";
import type { NotificationChannel, NotificationTemplate } from "@/generated/prisma/enums";
import { logger, redact } from "@/lib/logger";
import { isTrMobile } from "@/lib/phone";
import { formatDate, formatTime } from "@/lib/time";
import { decryptSecret } from "@/lib/crypto";
import {
  adminNotificationFallback,
  getEmailProvider,
  getSmsProvider,
  getWhatsappProvider,
  resolveEmailRecipient,
  resolveSmsRecipient,
  resolveWhatsappRecipient,
} from "@/lib/notifications/config";
import { buildAttendancePayload, type WhatsappProvider } from "@/lib/notifications/whatsapp/types";
import { renderAdminRequestEmail, renderPatientEmail, renderSms } from "@/lib/notifications/templates";
import { ProviderError, type EmailProvider, type SmsProvider } from "@/lib/notifications/types";

export const NOTIFICATION_MAX_ATTEMPTS = 5;

export function notificationBackoffMs(attempt: number): number {
  return Math.min(120, 2 ** attempt) * 60_000;
}

type PatientTemplate = Exclude<NotificationTemplate, "ADMIN_NEW_REQUEST" | "PATIENT_REMINDER_24H" | "PATIENT_FORM_LINK">;

/**
 * Randevu olayına ait bildirimleri outbox'a yazar. Randevu değişikliğiyle aynı transaction
 * içinde çağrılır; böylece sağlayıcı hatası veya sunucu kesintisi bildirimi kaybettirmez.
 * eventKey (ör. durum geçmişi id'si) aynı olay için mükerrer bildirim oluşmasını engeller.
 */
export async function enqueueAppointmentNotifications(
  tx: Tx,
  input: { appointmentId: string; template: NotificationTemplate; eventKey: string },
): Promise<number> {
  const appt = await tx.appointment.findUniqueOrThrow({
    where: { id: input.appointmentId },
    include: {
      clinic: true,
      dentist: { select: { title: true, firstName: true, lastName: true } },
      patient: { select: { firstName: true, phone: true, email: true } },
      service: { select: { name: true } },
    },
  });
  const dentistName = `${appt.dentist.title} ${appt.dentist.firstName} ${appt.dentist.lastName}`;
  const date = formatDate(appt.startsAt);
  const time = formatTime(appt.startsAt);
  const rows: {
    channel: NotificationChannel;
    recipient: string;
    subject: string | null;
    body: string;
  }[] = [];

  if (input.template === "ADMIN_NEW_REQUEST") {
    const to = appt.clinic.notificationEmail || adminNotificationFallback();
    if (to) {
      const mail = renderAdminRequestEmail({
        clinicName: appt.clinic.name,
        requesterName: `${appt.requesterFirstName} ${appt.requesterLastName}`,
        date,
        time,
        dentist: dentistName,
        serviceName: appt.service?.name,
        panelUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/admin/randevular/${appt.id}`,
      });
      rows.push({ channel: "EMAIL", recipient: to, subject: mail.subject, body: mail.text });
    }
  } else if (input.template === "PATIENT_REMINDER_24H" || input.template === "PATIENT_FORM_LINK") {
    // Hatırlatmalar enqueueDueReminders(), form bağlantıları features/forms/service.ts ile planlanır.
    return 0;
  } else {
    const template = input.template as PatientTemplate;
    const data = {
      firstName: appt.patient?.firstName ?? appt.requesterFirstName,
      clinicName: appt.clinic.name,
      date,
      time,
      dentist: dentistName,
      clinicPhone: appt.clinic.phone,
    };
    const phone = appt.patient?.phone ?? appt.requesterPhone;
    if (phone && isTrMobile(phone)) {
      rows.push({ channel: "SMS", recipient: phone, subject: null, body: renderSms(template, data) });
    }
    const email = appt.patient?.email || appt.requesterEmail;
    if (email) {
      const mail = renderPatientEmail(template, data);
      rows.push({ channel: "EMAIL", recipient: email, subject: mail.subject, body: mail.text });
    }
  }

  if (rows.length === 0) return 0;
  const result = await tx.notificationLog.createMany({
    data: rows.map((row) => ({
      clinicId: appt.clinicId,
      appointmentId: appt.id,
      template: input.template,
      idempotencyKey: `${input.template}:${appt.id}:${input.eventKey}:${row.channel}`,
      ...row,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export type DispatchDeps = { email?: EmailProvider; sms?: SmsProvider; whatsapp?: WhatsappProvider; now?: () => Date };
export type DispatchOutcome = "sent" | "failed" | "skipped";

/** Tek bir bildirimi gönderir. Atomik "claim" sayesinde aynı kayıt iki kez gönderilmez. */
export async function dispatchNotification(id: string, deps: DispatchDeps = {}): Promise<DispatchOutcome> {
  const now = deps.now?.() ?? new Date();
  const claimed = await db.notificationLog.updateMany({
    where: { id, status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now } },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return "skipped";

  const log = await db.notificationLog.findUniqueOrThrow({ where: { id } });
  if (log.channel === "WHATSAPP") return dispatchWhatsappReminder(log, deps, now);
  const emailProvider = deps.email ?? getEmailProvider();
  const smsProvider = deps.sms ?? getSmsProvider();
  const providerName = log.channel === "SMS" ? smsProvider.name : emailProvider.name;

  try {
    const result =
      log.channel === "SMS"
        ? await smsProvider.send({ to: resolveSmsRecipient(log.recipient), text: log.body })
        : await emailProvider.send({
            to: log.template === "ADMIN_NEW_REQUEST" ? log.recipient : resolveEmailRecipient(log.recipient),
            subject: log.subject ?? "",
            text: log.body,
          });
    await db.notificationLog.update({
      where: { id },
      data: {
        status: "SENT",
        provider: providerName,
        providerMessageId: result.providerMessageId,
        sentAt: now,
        lastError: null,
        nextAttemptAt: null,
      },
    });
    return "sent";
  } catch (error) {
    const retryable = error instanceof ProviderError ? error.retryable : true;
    const canRetry = retryable && log.attempts < NOTIFICATION_MAX_ATTEMPTS;
    const message = redact(error instanceof Error ? error.message : String(error)).slice(0, 500);
    await db.notificationLog.update({
      where: { id },
      data: {
        status: "FAILED",
        provider: providerName,
        lastError: message,
        nextAttemptAt: canRetry ? new Date(now.getTime() + notificationBackoffMs(log.attempts)) : null,
      },
    });
    logger.warn("notification.send_failed", { notificationId: id, channel: log.channel, retry: canRetry });
    return "failed";
  }
}

type WhatsappLog = Awaited<ReturnType<typeof db.notificationLog.findUniqueOrThrow>>;

async function skipNotification(id: string, reason: string): Promise<DispatchOutcome> {
  await db.notificationLog.update({ where: { id }, data: { status: "SKIPPED", lastError: reason, nextAttemptAt: null } });
  return "skipped";
}

/**
 * WhatsApp hatırlatmasını gönderir. Gönderim anında randevunun hâlâ onaylı ve gelecekte olduğu,
 * kliniğin WhatsApp'ı açık tuttuğu ve hastanın daha önce yanıt vermediği yeniden doğrulanır.
 */
async function dispatchWhatsappReminder(log: WhatsappLog, deps: DispatchDeps, now: Date): Promise<DispatchOutcome> {
  const [appt, config] = await Promise.all([
    log.appointmentId
      ? db.appointment.findUnique({
          where: { id: log.appointmentId },
          include: {
            clinic: { select: { name: true } },
            dentist: { select: { title: true, firstName: true, lastName: true } },
            patient: { select: { firstName: true } },
          },
        })
      : null,
    db.clinicWhatsappConfig.findUnique({ where: { clinicId: log.clinicId } }),
  ]);
  if (!appt || appt.status !== "CONFIRMED" || appt.startsAt <= now) return skipNotification(log.id, "Randevu artık geçerli değil.");
  if (appt.attendanceResponse) return skipNotification(log.id, "Hasta zaten yanıt verdi.");
  if (!config?.isEnabled) return skipNotification(log.id, "Klinikte WhatsApp hatırlatması kapalı.");

  try {
    const provider =
      deps.whatsapp ?? getWhatsappProvider({ phoneNumberId: config.phoneNumberId, accessToken: decryptSecret(config.accessTokenEnc) });
    const result = await provider.sendTemplate({
      to: resolveWhatsappRecipient(log.recipient),
      templateName: config.templateName,
      language: config.templateLanguage,
      bodyParams: [
        appt.patient?.firstName ?? appt.requesterFirstName,
        appt.clinic.name,
        formatDate(appt.startsAt),
        formatTime(appt.startsAt),
        `${appt.dentist.title} ${appt.dentist.firstName} ${appt.dentist.lastName}`,
      ],
      buttonPayloads: [buildAttendancePayload("YES", appt.id), buildAttendancePayload("NO", appt.id)],
    });
    await db.notificationLog.update({
      where: { id: log.id },
      data: { status: "SENT", provider: provider.name, providerMessageId: result.providerMessageId, sentAt: now, lastError: null, nextAttemptAt: null },
    });
    return "sent";
  } catch (error) {
    const retryable = error instanceof ProviderError ? error.retryable : true;
    const canRetry = retryable && log.attempts < NOTIFICATION_MAX_ATTEMPTS;
    const message = redact(error instanceof Error ? error.message : String(error)).slice(0, 500);
    await db.notificationLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        provider: "whatsapp",
        lastError: message,
        nextAttemptAt: canRetry ? new Date(now.getTime() + notificationBackoffMs(log.attempts)) : null,
      },
    });
    await db.clinicWhatsappConfig.update({ where: { clinicId: log.clinicId }, data: { lastError: message } });
    logger.warn("notification.send_failed", { notificationId: log.id, channel: log.channel, retry: canRetry });
    return "failed";
  }
}

export async function recoverStaleNotifications(now = new Date()): Promise<void> {
  await db.notificationLog.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
    data: { status: "FAILED", nextAttemptAt: now, lastError: "Gönderim yarıda kaldı; yeniden denenecek." },
  });
}

export async function dispatchPendingNotifications(
  options: { limit?: number; appointmentId?: string } = {},
  deps: DispatchDeps = {},
): Promise<Record<DispatchOutcome, number>> {
  const now = deps.now?.() ?? new Date();
  const due = await db.notificationLog.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: now },
      ...(options.appointmentId ? { appointmentId: options.appointmentId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 25,
    select: { id: true },
  });
  const result: Record<DispatchOutcome, number> = { sent: 0, failed: 0, skipped: 0 };
  for (const { id } of due) {
    result[await dispatchNotification(id, deps)] += 1;
  }
  return result;
}
