import "server-only";
import { db } from "@/lib/db";
import { isTrMobile, normalizeTrPhone } from "@/lib/phone";

export const REMINDER_LEAD_MS = 24 * 60 * 60_000;
/** Randevuya bundan az kaldıysa hatırlatma gönderilmez (hasta yanıt veremeyecek kadar geç olur). */
export const REMINDER_MIN_LEAD_MS = 60 * 60_000;

export function reminderIdempotencyKey(appointmentId: string, startsAt: Date): string {
  // startsAt anahtarın parçası: randevu başka saate alınırsa yeni hatırlatma planlanır.
  return `PATIENT_REMINDER_24H:${appointmentId}:${startsAt.getTime()}:WHATSAPP`;
}

/**
 * Önümüzdeki 24 saat içinde başlayacak, onaylı ve WhatsApp'ı açık kliniklere ait randevular için
 * hatırlatma kaydı oluşturur. Cron her çalıştığında çağrılır; idempotencyKey mükerrer kayıt oluşmasını önler.
 * Gönderim anında randevunun hâlâ geçerli olup olmadığı dispatch aşamasında yeniden kontrol edilir.
 */
export async function enqueueDueReminders(now = new Date(), limit = 200): Promise<number> {
  const appointments = await db.appointment.findMany({
    where: {
      status: "CONFIRMED",
      startsAt: { gt: new Date(now.getTime() + REMINDER_MIN_LEAD_MS), lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
      attendanceResponse: null,
      clinic: { whatsappConfig: { is: { isEnabled: true } } },
    },
    select: {
      id: true,
      clinicId: true,
      startsAt: true,
      requesterPhone: true,
      patient: { select: { phone: true } },
    },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
  const candidates = appointments
    .map((a) => ({ ...a, phone: normalizeTrPhone(a.patient?.phone ?? a.requesterPhone) }))
    .filter((a): a is typeof a & { phone: string } => a.phone !== null && isTrMobile(a.phone));
  if (candidates.length === 0) return 0;

  const result = await db.notificationLog.createMany({
    data: candidates.map((a) => ({
      clinicId: a.clinicId,
      appointmentId: a.id,
      channel: "WHATSAPP" as const,
      template: "PATIENT_REMINDER_24H" as const,
      recipient: a.phone,
      body: "Randevu hatırlatması (WhatsApp şablonu)",
      idempotencyKey: reminderIdempotencyKey(a.id, a.startsAt),
    })),
    skipDuplicates: true,
  });
  return result.count;
}
