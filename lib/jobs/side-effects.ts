import "server-only";
import { logger } from "@/lib/logger";
import {
  dispatchPendingNotifications,
  recoverStaleNotifications,
  type DispatchDeps,
} from "@/lib/notifications/outbox";
import {
  processPendingCalendarSyncs,
  recoverStaleCalendarJobs,
} from "@/lib/google-calendar/sync";
import type { GoogleDeps } from "@/lib/google-calendar/client";

/**
 * Bir randevu işleminden sonra outbox'taki bildirim ve takvim işlerini hemen işlemeyi dener.
 * Başarısız olanlar kuyrukta kalır ve cron (/api/cron/outbox) ile yeniden denenir.
 * Hata fırlatmaz: randevu işlemi zaten veritabanına kaydedilmiştir.
 */
export async function processAppointmentSideEffects(
  appointmentId: string,
  deps: { notifications?: DispatchDeps; google?: GoogleDeps } = {},
): Promise<void> {
  try {
    await dispatchPendingNotifications({ appointmentId }, deps.notifications);
  } catch (error) {
    logger.error("side_effects.notifications_failed", error);
  }
  try {
    await processPendingCalendarSyncs({ appointmentId }, deps.google);
  } catch (error) {
    logger.error("side_effects.calendar_failed", error);
  }
}

export async function processOutbox(limit = 50) {
  await Promise.all([recoverStaleNotifications(), recoverStaleCalendarJobs()]);
  const notifications = await dispatchPendingNotifications({ limit });
  const calendar = await processPendingCalendarSyncs({ limit });
  return { notifications, calendar };
}
