import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { tr } from "date-fns/locale";

/** Klinik saat dilimi. Veritabanında tüm zamanlar UTC tutulur. */
export const CLINIC_TZ = "Europe/Istanbul";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): boolean {
  if (!DATE_KEY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

function parseKey(dateKey: string): [number, number, number] {
  if (!isDateKey(dateKey)) throw new Error(`Geçersiz tarih: ${dateKey}`);
  const [y, m, d] = dateKey.split("-").map(Number);
  return [y, m, d];
}

/** "2026-10-18" + 540 dk → o günün yerel 09:00'ının UTC karşılığı */
export function zonedTimeToUtc(dateKey: string, minuteOfDay: number, tz = CLINIC_TZ): Date {
  const [y, m, d] = parseKey(dateKey);
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return new Date(new TZDate(y, m - 1, d, hours, minutes, 0, tz).getTime());
}

/** Yerel günün [başlangıç, bitiş) aralığı (UTC) */
export function dayRangeUtc(dateKey: string, tz = CLINIC_TZ): { start: Date; end: Date } {
  const start = zonedTimeToUtc(dateKey, 0, tz);
  const next = addDaysToKey(dateKey, 1);
  return { start, end: zonedTimeToUtc(next, 0, tz) };
}

/** ISO hafta günü: 1 = Pazartesi … 7 = Pazar */
export function isoWeekdayOfKey(dateKey: string, tz = CLINIC_TZ): number {
  const [y, m, d] = parseKey(dateKey);
  const day = new TZDate(y, m - 1, d, 12, 0, 0, tz).getDay();
  return day === 0 ? 7 : day;
}

export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = parseKey(dateKey);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Bir anın klinik saat dilimindeki tarih anahtarı */
export function dateKeyInTz(date: Date, tz = CLINIC_TZ): string {
  return format(new TZDate(date, tz), "yyyy-MM-dd");
}

/** Bir anın klinik saat dilimindeki gün içi dakikası */
export function minuteOfDayInTz(date: Date, tz = CLINIC_TZ): number {
  const z = new TZDate(date, tz);
  return z.getHours() * 60 + z.getMinutes();
}

export function todayKey(now = new Date(), tz = CLINIC_TZ): string {
  return dateKeyInTz(now, tz);
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hhmmToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// ───── Görüntüleme (Türkiye biçimi) ─────

export function formatDate(date: Date, tz = CLINIC_TZ): string {
  return format(new TZDate(date, tz), "dd.MM.yyyy");
}

export function formatTime(date: Date, tz = CLINIC_TZ): string {
  return format(new TZDate(date, tz), "HH:mm");
}

export function formatDateTime(date: Date, tz = CLINIC_TZ): string {
  return format(new TZDate(date, tz), "dd.MM.yyyy HH:mm");
}

export function formatLongDate(date: Date, tz = CLINIC_TZ): string {
  return format(new TZDate(date, tz), "d MMMM yyyy, EEEE", { locale: tr });
}

export function formatDateKeyLong(dateKey: string): string {
  const [y, m, d] = parseKey(dateKey);
  return format(new Date(y, m - 1, d), "d MMMM yyyy, EEEE", { locale: tr });
}

// ───── Yalnızca tarih (@db.Date) alanları: UTC gece yarısı olarak saklanır ─────

export function dateKeyToDateOnly(dateKey: string): Date {
  parseKey(dateKey);
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function dateOnlyToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDateOnly(date: Date): string {
  const [y, m, d] = dateOnlyToKey(date).split("-");
  return `${d}.${m}.${y}`;
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

export { addDays };
