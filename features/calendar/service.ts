import "server-only";
import { db, type DbOrTx } from "@/lib/db";
import { getExternalBusy } from "@/lib/google-calendar/freebusy";
import type { GoogleDeps } from "@/lib/google-calendar/client";
import { addDaysToKey, dayRangeUtc, isoWeekdayOfKey, todayKey } from "@/lib/time";
import { computeSlots, type DaySchedule, type Interval, type Slot } from "@/features/calendar/availability";

/** Online taleplerde en erken randevu: şu andan 2 saat sonrası */
export const PUBLIC_MIN_LEAD_MINUTES = 120;
/** Online taleplerde en fazla kaç gün sonrasına randevu alınabilir */
export const PUBLIC_BOOKING_HORIZON_DAYS = 60;

export const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED"] as const;

export type AvailabilityResult = {
  dateKey: string;
  slotMinutes: number;
  slots: Slot[];
  closedReason: string | null;
  externalCalendar: "not_connected" | "ok" | "unavailable" | "skipped";
};

/** Hekimin bir gündeki meşgul aralıkları: aktif randevular + izin/kapalı zamanlar */
export async function getInternalBusy(
  client: DbOrTx,
  dentistId: string,
  range: { start: Date; end: Date },
  excludeAppointmentId?: string,
): Promise<Interval[]> {
  const [appointments, blocked] = await Promise.all([
    client.appointment.findMany({
      where: {
        dentistId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        startsAt: { lt: range.end },
        endsAt: { gt: range.start },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { startsAt: true, endsAt: true },
    }),
    client.blockedTime.findMany({
      where: { dentistId, startsAt: { lt: range.end }, endsAt: { gt: range.start } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);
  return [
    ...appointments.map((a) => ({ start: a.startsAt, end: a.endsAt })),
    ...blocked.map((b) => ({ start: b.startsAt, end: b.endsAt })),
  ];
}

export async function getDaySchedule(client: DbOrTx, dentistId: string, dateKey: string): Promise<DaySchedule | null> {
  const row = await client.workingHour.findUnique({
    where: { dentistId_weekday: { dentistId, weekday: isoWeekdayOfKey(dateKey) } },
  });
  return row
    ? {
        startMinute: row.startMinute,
        endMinute: row.endMinute,
        breakStartMinute: row.breakStartMinute,
        breakEndMinute: row.breakEndMinute,
      }
    : null;
}

export async function getAvailability(input: {
  clinicId: string;
  dentistId: string;
  dateKey: string;
  mode: "public" | "staff";
  excludeAppointmentId?: string;
  now?: Date;
  googleDeps?: GoogleDeps;
}): Promise<AvailabilityResult> {
  const now = input.now ?? new Date();
  const dentist = await db.dentistProfile.findFirst({
    where: { id: input.dentistId, clinicId: input.clinicId },
    select: { id: true, slotMinutes: true, isActive: true, acceptsOnlineBooking: true },
  });
  const base = { dateKey: input.dateKey, slotMinutes: dentist?.slotMinutes ?? 30, slots: [] as Slot[] };

  if (!dentist || !dentist.isActive) {
    return { ...base, closedReason: "Bu doktor şu anda randevu kabul etmiyor.", externalCalendar: "skipped" };
  }
  if (input.mode === "public") {
    if (!dentist.acceptsOnlineBooking) {
      return { ...base, closedReason: "Bu doktor için online randevu kapalıdır; lütfen kliniği arayın.", externalCalendar: "skipped" };
    }
    const today = todayKey(now);
    if (input.dateKey < today) {
      return { ...base, closedReason: "Geçmiş bir tarih seçilemez.", externalCalendar: "skipped" };
    }
    if (input.dateKey > addDaysToKey(today, PUBLIC_BOOKING_HORIZON_DAYS)) {
      return {
        ...base,
        closedReason: `Online randevular en fazla ${PUBLIC_BOOKING_HORIZON_DAYS} gün sonrası için alınabilir.`,
        externalCalendar: "skipped",
      };
    }
  }

  const schedule = await getDaySchedule(db, dentist.id, input.dateKey);
  if (!schedule) {
    return { ...base, closedReason: "Doktorun bu gün çalışma programı bulunmuyor.", externalCalendar: "skipped" };
  }

  const range = dayRangeUtc(input.dateKey);
  const internal = await getInternalBusy(db, dentist.id, range, input.excludeAppointmentId);
  const external =
    input.mode === "public"
      ? await getExternalBusy(input.clinicId, dentist.id, range, input.googleDeps)
      : ({ status: "skipped", busy: [] } as const);

  const slots = computeSlots({
    dateKey: input.dateKey,
    schedule,
    slotMinutes: dentist.slotMinutes,
    busy: [...internal, ...external.busy],
    now,
    minLeadMinutes: input.mode === "public" ? PUBLIC_MIN_LEAD_MINUTES : 0,
  });

  return {
    ...base,
    slots,
    closedReason: slots.length === 0 ? "Bu tarihte uygun saat kalmadı. Lütfen başka bir gün seçin." : null,
    externalCalendar: external.status,
  };
}
