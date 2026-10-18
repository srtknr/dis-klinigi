import "server-only";
import { db, type Tx } from "@/lib/db";
import { googleCalendarRequest, type GoogleDeps } from "@/lib/google-calendar/client";
import { GoogleApiError } from "@/lib/google-calendar/errors";
import { buildEventPayload, googleEventIdFor } from "@/lib/google-calendar/events";
import { logger } from "@/lib/logger";

export const CALENDAR_MAX_ATTEMPTS = 6;

export function calendarBackoffMs(attempt: number): number {
  return Math.min(60, 2 ** attempt) * 60_000;
}

/**
 * Randevunun güncel durumuna göre takvim eşleşmelerini "senkronizasyon bekliyor" olarak işaretler.
 * Randevu güncellemesiyle aynı transaction içinde çağrılır (outbox deseni); asıl API çağrısı
 * transaction dışında processCalendarMapping ile yapılır.
 */
export async function requestCalendarSync(tx: Tx, appointmentId: string): Promise<string[]> {
  const appointment = await tx.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    select: { id: true, clinicId: true, dentistId: true, status: true },
  });
  const connections = await tx.googleCalendarConnection.findMany({
    where: {
      clinicId: appointment.clinicId,
      status: { in: ["ACTIVE", "ERROR"] },
      OR: [{ dentistId: null }, { dentistId: appointment.dentistId }],
    },
    select: { id: true },
  });
  const targetIds = new Set(connections.map((c) => c.id));
  const shouldExist = appointment.status === "CONFIRMED";
  const existing = await tx.calendarEventMapping.findMany({ where: { appointmentId } });
  const touched: string[] = [];

  for (const mapping of existing) {
    const desiredState = shouldExist && targetIds.has(mapping.connectionId) ? "PRESENT" : "ABSENT";
    await tx.calendarEventMapping.update({
      where: { id: mapping.id },
      data: { desiredState, syncStatus: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastError: null },
    });
    touched.push(mapping.id);
    targetIds.delete(mapping.connectionId);
  }

  if (shouldExist) {
    for (const connectionId of targetIds) {
      const created = await tx.calendarEventMapping.create({
        data: {
          appointmentId,
          connectionId,
          googleEventId: googleEventIdFor(appointmentId, connectionId),
          desiredState: "PRESENT",
        },
      });
      touched.push(created.id);
    }
  }
  return touched;
}

async function claimMapping(mappingId: string, now: Date): Promise<boolean> {
  const claimed = await db.calendarEventMapping.updateMany({
    where: {
      id: mappingId,
      syncStatus: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: now },
    },
    data: { syncStatus: "PROCESSING", attempts: { increment: 1 } },
  });
  return claimed.count === 1;
}

export type CalendarSyncOutcome = "synced" | "failed" | "skipped";

/** Tek bir eşleşmeyi Google Calendar ile senkronize eder. Hata durumunda uygulamayı çökertmez. */
export async function processCalendarMapping(mappingId: string, deps: GoogleDeps = {}): Promise<CalendarSyncOutcome> {
  const now = deps.now?.() ?? new Date();
  if (!(await claimMapping(mappingId, now))) return "skipped";

  const mapping = await db.calendarEventMapping.findUniqueOrThrow({
    where: { id: mappingId },
    include: {
      connection: true,
      appointment: {
        include: {
          dentist: { select: { title: true, firstName: true, lastName: true } },
          clinic: { select: { name: true } },
          patient: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  const { connection, appointment } = mapping;
  const calendarPath = `/calendars/${encodeURIComponent(connection.calendarId)}/events`;

  try {
    if (connection.status === "REVOKED") {
      throw new GoogleApiError("Google bağlantısı geri alınmış; hesabı yeniden bağlayın.", 0, false, true);
    }

    if (mapping.desiredState === "PRESENT" && appointment.status === "CONFIRMED") {
      const payload = buildEventPayload(mapping.googleEventId, {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        patientFirstName: appointment.patient?.firstName ?? appointment.requesterFirstName,
        patientLastName: appointment.patient?.lastName ?? appointment.requesterLastName,
        dentistName: `${appointment.dentist.title} ${appointment.dentist.firstName} ${appointment.dentist.lastName}`,
        clinicName: appointment.clinic.name,
        appUrl: process.env.APP_URL ?? "http://localhost:3000",
      });
      await upsertEvent(connection, calendarPath, mapping.googleEventId, payload, deps);
    } else {
      await deleteEvent(connection, calendarPath, mapping.googleEventId, deps);
    }

    await db.$transaction([
      db.calendarEventMapping.update({
        where: { id: mapping.id },
        data: { syncStatus: "SYNCED", lastSyncedAt: now, lastError: null, nextAttemptAt: null },
      }),
      db.googleCalendarConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: now, ...(connection.status === "ERROR" ? { status: "ACTIVE", lastError: null } : {}) },
      }),
    ]);
    return "synced";
  } catch (error) {
    const apiError =
      error instanceof GoogleApiError ? error : new GoogleApiError("Beklenmeyen senkronizasyon hatası", 0, true);
    const attempts = mapping.attempts;
    const canRetry = apiError.retryable && attempts < CALENDAR_MAX_ATTEMPTS;
    await db.calendarEventMapping.update({
      where: { id: mapping.id },
      data: {
        syncStatus: "FAILED",
        lastError: apiError.message.slice(0, 500),
        nextAttemptAt: canRetry ? new Date(now.getTime() + calendarBackoffMs(attempts)) : null,
      },
    });
    if (apiError.authFailure && connection.status === "ACTIVE") {
      await db.googleCalendarConnection.update({
        where: { id: connection.id },
        data: { status: "ERROR", lastError: apiError.message.slice(0, 500) },
      });
    }
    logger.warn("calendar.sync_failed", { mappingId: mapping.id, status: apiError.status, retry: canRetry });
    return "failed";
  }
}

async function upsertEvent(
  connection: Parameters<typeof googleCalendarRequest>[0],
  calendarPath: string,
  eventId: string,
  payload: ReturnType<typeof buildEventPayload>,
  deps: GoogleDeps,
) {
  try {
    await googleCalendarRequest(connection, "PUT", `${calendarPath}/${eventId}`, payload, deps);
  } catch (error) {
    if (!(error instanceof GoogleApiError) || error.status !== 404) throw error;
    try {
      await googleCalendarRequest(connection, "POST", calendarPath, payload, deps);
    } catch (insertError) {
      // 409: aynı kimlikle etkinlik zaten var (ör. eşzamanlı deneme) — güncellemeyle tamamla
      if (insertError instanceof GoogleApiError && insertError.status === 409) {
        await googleCalendarRequest(connection, "PUT", `${calendarPath}/${eventId}`, payload, deps);
        return;
      }
      throw insertError;
    }
  }
}

async function deleteEvent(
  connection: Parameters<typeof googleCalendarRequest>[0],
  calendarPath: string,
  eventId: string,
  deps: GoogleDeps,
) {
  try {
    await googleCalendarRequest(connection, "DELETE", `${calendarPath}/${eventId}?sendUpdates=none`, undefined, deps);
  } catch (error) {
    // Etkinlik hiç oluşmamış veya zaten silinmiş
    if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) return;
    throw error;
  }
}

/** Uzun süre PROCESSING'de kalan (ör. sunucu yeniden başladı) kayıtları kuyruğa geri alır */
export async function recoverStaleCalendarJobs(now = new Date()): Promise<void> {
  await db.calendarEventMapping.updateMany({
    where: { syncStatus: "PROCESSING", updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
    data: { syncStatus: "FAILED", nextAttemptAt: now, lastError: "İşlem yarıda kaldı; yeniden denenecek." },
  });
}

export async function processPendingCalendarSyncs(
  options: { limit?: number; appointmentId?: string } = {},
  deps: GoogleDeps = {},
): Promise<Record<CalendarSyncOutcome, number>> {
  const now = deps.now?.() ?? new Date();
  const due = await db.calendarEventMapping.findMany({
    where: {
      syncStatus: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: now },
      ...(options.appointmentId ? { appointmentId: options.appointmentId } : {}),
    },
    orderBy: { nextAttemptAt: "asc" },
    take: options.limit ?? 25,
    select: { id: true },
  });
  const result: Record<CalendarSyncOutcome, number> = { synced: 0, failed: 0, skipped: 0 };
  for (const { id } of due) {
    result[await processCalendarMapping(id, deps)] += 1;
  }
  return result;
}
