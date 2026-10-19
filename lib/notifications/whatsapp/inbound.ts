import "server-only";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeTrPhone } from "@/lib/phone";
import { formatDate, formatTime } from "@/lib/time";
import { extractButtonReplies, type InboundMessage } from "@/lib/notifications/whatsapp/webhook-parse";
import { parseAttendancePayload } from "@/lib/notifications/whatsapp/types";

export type InboundOutcome = "recorded" | "duplicate" | "ignored";

/**
 * Hastanın "Evet / Hayır" yanıtını randevuya işler ve hekim ile asistanlara panel bildirimi oluşturur.
 * Yanıt; payload'daki randevunun bu klinikte olması, gönderenin randevudaki telefonla eşleşmesi ve
 * randevunun hâlâ onaylı/gelecekte olması koşullarıyla kabul edilir.
 */
export async function recordAttendanceReply(
  phoneNumberId: string,
  message: InboundMessage,
  now = new Date(),
): Promise<InboundOutcome> {
  const parsed = parseAttendancePayload(message.payload);
  if (!parsed) return "ignored";
  const config = await db.clinicWhatsappConfig.findUnique({ where: { phoneNumberId }, select: { clinicId: true } });
  if (!config) return "ignored";

  const appt = await db.appointment.findFirst({
    where: { id: parsed.appointmentId, clinicId: config.clinicId },
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true } },
      dentist: { select: { userId: true, title: true, firstName: true, lastName: true } },
    },
  });
  if (!appt || appt.status !== "CONFIRMED" || appt.startsAt <= now) return "ignored";

  const senderPhone = normalizeTrPhone(`+${message.from}`);
  const apptPhone = normalizeTrPhone(appt.patient?.phone ?? appt.requesterPhone);
  if (!senderPhone || senderPhone !== apptPhone) {
    logger.warn("whatsapp.inbound_phone_mismatch", { appointmentId: appt.id });
    return "ignored";
  }
  if (appt.attendanceResponse === parsed.response) return "duplicate";

  const person = appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : `${appt.requesterFirstName} ${appt.requesterLastName}`;
  const coming = parsed.response === "YES";

  await db.$transaction(async (tx) => {
    // Koşullu güncelleme: aynı anda gelen yinelenen webhook çağrılarında bildirim bir kez oluşur
    const updated = await tx.appointment.updateMany({
      where: { id: appt.id, status: "CONFIRMED", NOT: { attendanceResponse: parsed.response } },
      data: { attendanceResponse: parsed.response, attendanceRespondedAt: now },
    });
    if (updated.count !== 1) return;

    // Alıcılar: randevunun hekimi + klinikteki aktif editörler (asistan)
    const memberships = await tx.membership.findMany({
      where: {
        clinicId: appt.clinicId,
        isActive: true,
        user: { isActive: true },
        OR: [{ role: "EDITOR" }, ...(appt.dentist.userId ? [{ userId: appt.dentist.userId }] : [])],
      },
      select: { userId: true },
    });
    const userIds = [...new Set(memberships.map((m) => m.userId))];
    if (userIds.length > 0) {
      await tx.staffNotification.createMany({
        data: userIds.map((userId) => ({
          clinicId: appt.clinicId,
          userId,
          appointmentId: appt.id,
          kind: coming ? "ATTENDANCE_YES" : "ATTENDANCE_NO",
          title: coming ? `${person} randevuya geleceğini bildirdi` : `${person} randevuya gelemeyeceğini bildirdi`,
          body: `${formatDate(appt.startsAt)} ${formatTime(appt.startsAt)} · ${appt.dentist.title} ${appt.dentist.firstName} ${appt.dentist.lastName}`,
        })),
      });
    }
    await writeAudit(tx, {
      clinicId: appt.clinicId,
      action: "appointment.attendance_reply",
      entityType: "Appointment",
      entityId: appt.id,
      metadata: { response: parsed.response, channel: "WHATSAPP" },
    });
  });
  return "recorded";
}

export async function processInboundWebhook(body: unknown): Promise<Record<InboundOutcome, number>> {
  const result: Record<InboundOutcome, number> = { recorded: 0, duplicate: 0, ignored: 0 };
  for (const group of extractButtonReplies(body)) {
    for (const message of group.messages) {
      result[await recordAttendanceReply(group.phoneNumberId, message)] += 1;
    }
  }
  return result;
}
