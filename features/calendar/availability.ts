import { CLINIC_TZ, minutesToHHMM, zonedTimeToUtc } from "@/lib/time";

export type Interval = { start: Date; end: Date };

export type DaySchedule = {
  startMinute: number;
  endMinute: number;
  breakStartMinute?: number | null;
  breakEndMinute?: number | null;
};

export type Slot = { start: string; end: string; time: string };

export type ComputeSlotsInput = {
  dateKey: string;
  schedule: DaySchedule | null;
  slotMinutes: number;
  /** Mevcut randevular, izinler ve harici takvim meşguliyetleri */
  busy: Interval[];
  now: Date;
  /** Şu andan itibaren en erken kaç dakika sonrası için randevu alınabilir */
  minLeadMinutes?: number;
  tz?: string;
};

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Bir gün için müsait randevu slotlarını hesaplar.
 * Slotlar çalışma başlangıcından itibaren slotMinutes aralıklarla üretilir; mola, meşgul aralıklar
 * ve geçmiş/çok yakın saatler hariç tutulur. Tamamen saf fonksiyondur.
 */
export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const { dateKey, schedule, slotMinutes, busy, now } = input;
  const tz = input.tz ?? CLINIC_TZ;
  if (!schedule || slotMinutes <= 0) return [];

  const earliest = new Date(now.getTime() + (input.minLeadMinutes ?? 0) * 60_000);
  const blocked: Interval[] = [...busy];
  if (schedule.breakStartMinute != null && schedule.breakEndMinute != null) {
    blocked.push({
      start: zonedTimeToUtc(dateKey, schedule.breakStartMinute, tz),
      end: zonedTimeToUtc(dateKey, schedule.breakEndMinute, tz),
    });
  }

  const slots: Slot[] = [];
  for (let m = schedule.startMinute; m + slotMinutes <= schedule.endMinute; m += slotMinutes) {
    const slot = {
      start: zonedTimeToUtc(dateKey, m, tz),
      end: zonedTimeToUtc(dateKey, m + slotMinutes, tz),
    };
    if (slot.start < earliest) continue;
    if (blocked.some((b) => overlaps(slot, b))) continue;
    slots.push({ start: slot.start.toISOString(), end: slot.end.toISOString(), time: minutesToHHMM(m) });
  }
  return slots;
}

/** Belirli bir aralığın çalışma saatleri içinde ve moladan bağımsız olup olmadığı */
export function fitsSchedule(schedule: DaySchedule | null, startMinute: number, endMinute: number): boolean {
  if (!schedule) return false;
  if (startMinute < schedule.startMinute || endMinute > schedule.endMinute) return false;
  if (schedule.breakStartMinute != null && schedule.breakEndMinute != null) {
    if (startMinute < schedule.breakEndMinute && schedule.breakStartMinute < endMinute) return false;
  }
  return true;
}
