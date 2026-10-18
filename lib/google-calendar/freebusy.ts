import "server-only";
import { db } from "@/lib/db";
import { googleCalendarRequest, type GoogleDeps } from "@/lib/google-calendar/client";
import { logger } from "@/lib/logger";
import type { Interval } from "@/features/calendar/availability";

export type ExternalBusyResult =
  | { status: "not_connected"; busy: [] }
  | { status: "ok"; busy: Interval[] }
  | { status: "unavailable"; busy: [] };

type FreeBusyResponse = { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> };

/**
 * Hekime özel bağlı Google takviminden dolu aralıkları okur. Klinik geneli takvim tüm hekimlerin
 * etkinliklerini içerdiği için müsaitlik hesabında kullanılmaz. Google'a ulaşılamazsa
 * uygulama içi takvim tek kaynak olarak kullanılmaya devam eder.
 */
export async function getExternalBusy(
  clinicId: string,
  dentistId: string,
  range: { start: Date; end: Date },
  deps: GoogleDeps = {},
): Promise<ExternalBusyResult> {
  const connection = await db.googleCalendarConnection.findFirst({
    where: { clinicId, dentistId, status: "ACTIVE" },
  });
  if (!connection) return { status: "not_connected", busy: [] };

  try {
    const { data } = await googleCalendarRequest<FreeBusyResponse>(
      connection,
      "POST",
      "/freeBusy",
      { timeMin: range.start.toISOString(), timeMax: range.end.toISOString(), items: [{ id: connection.calendarId }] },
      deps,
    );
    const calendar = data?.calendars?.[connection.calendarId];
    if (!calendar || (calendar.errors && calendar.errors.length > 0)) return { status: "unavailable", busy: [] };
    return {
      status: "ok",
      busy: (calendar.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) })),
    };
  } catch (error) {
    logger.warn("calendar.freebusy_failed", { connectionId: connection.id, reason: (error as Error).message });
    return { status: "unavailable", busy: [] };
  }
}
