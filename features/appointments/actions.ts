"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { runAction } from "@/lib/actions";
import { requireActionAuth } from "@/lib/auth/current";
import { errors } from "@/lib/errors";
import { processAppointmentSideEffects } from "@/lib/jobs/side-effects";
import { assertCan } from "@/lib/permissions/guard";
import { clientIpHash, getClientIp, rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/action";
import {
  addAppointmentNote,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAdminAppointment,
  createPublicAppointmentRequest,
  linkAppointmentPatient,
  markNoShow,
  rejectAppointment,
  rescheduleAppointment,
} from "@/features/appointments/service";
import { getAvailability, type AvailabilityResult } from "@/features/calendar/service";
import { listCalendarEvents, type CalendarEventDto } from "@/features/appointments/queries";
import { getPublicClinic } from "@/features/public/queries";
import { searchPatientsForPicker } from "@/features/patients/service";

function afterMutation(appointmentId: string) {
  after(() => processAppointmentSideEffects(appointmentId));
  revalidatePath("/admin", "layout");
}

/** Herkese açık randevu talebi (IP başına hız sınırlı). Server Action'lar Next.js tarafından Origin kontrolüyle CSRF'e karşı korunur. */
export async function submitAppointmentRequestAction(input: unknown): Promise<ActionResult<{ appointmentId: string }>> {
  return runAction(async () => {
    const h = await headers();
    const ip = getClientIp(h);
    const limit = await rateLimit("public-appointment", ip, 8, 60 * 60);
    if (!limit.ok) throw errors.rateLimited();
    const clinic = await getPublicClinic();
    if (!clinic) throw errors.notFound("Klinik");
    const result = await createPublicAppointmentRequest(input, { clinicId: clinic.id, ipHash: clientIpHash(h) });
    after(() => processAppointmentSideEffects(result.appointmentId));
    revalidatePath("/admin", "layout");
    return result;
  });
}

export async function createAppointmentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await createAdminAppointment(ctx, input);
    afterMutation(result.appointmentId);
    return result;
  }, "Randevu oluşturuldu.");
}

export async function confirmAppointmentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await confirmAppointment(ctx, input);
    afterMutation(result.appointmentId);
    return result;
  }, "Randevu onaylandı. Hastaya bildirim gönderiliyor.");
}

export async function rejectAppointmentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await rejectAppointment(ctx, input);
    afterMutation(result.appointmentId);
    return result;
  }, "Randevu talebi reddedildi.");
}

export async function cancelAppointmentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await cancelAppointment(ctx, input);
    afterMutation(result.appointmentId);
    return result;
  }, "Randevu iptal edildi.");
}

export async function completeAppointmentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await completeAppointment(ctx, input);
    afterMutation(result.appointmentId);
    return result;
  }, "Randevu tamamlandı olarak işaretlendi.");
}

export async function noShowAppointmentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await markNoShow(ctx, input);
    afterMutation(result.appointmentId);
    return result;
  }, "Randevu 'gelmedi' olarak işaretlendi.");
}

export async function rescheduleAppointmentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await rescheduleAppointment(ctx, input);
    afterMutation(result.appointmentId);
    return result;
  }, "Randevu yeniden planlandı.");
}

export async function addAppointmentNoteAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await addAppointmentNote(ctx, input);
    revalidatePath("/admin", "layout");
    return result;
  }, "Not eklendi.");
}

export async function linkPatientAction(appointmentId: string, patientId: string) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await linkAppointmentPatient(ctx, String(appointmentId), String(patientId));
    revalidatePath("/admin", "layout");
    return result;
  }, "Randevu hasta kaydıyla eşleştirildi.");
}

/** Panel için müsait saatler (çalışma programı + mevcut randevular + izinler) */
export async function getStaffAvailabilityAction(input: {
  dentistId: string;
  date: string;
  excludeAppointmentId?: string;
}): Promise<ActionResult<AvailabilityResult>> {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    assertCan(ctx, "APPOINTMENT_VIEW");
    return getAvailability({
      clinicId: ctx.clinicId,
      dentistId: String(input.dentistId),
      dateKey: String(input.date),
      mode: "staff",
      excludeAppointmentId: input.excludeAppointmentId ? String(input.excludeAppointmentId) : undefined,
    });
  });
}

export async function getCalendarEventsAction(input: {
  from: string;
  to: string;
  dentistId?: string;
  includeInactive?: boolean;
}): Promise<ActionResult<CalendarEventDto[]>> {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw errors.validation("Geçersiz tarih aralığı.");
    return listCalendarEvents(ctx, { from, to }, { dentistId: input.dentistId || undefined, includeInactive: input.includeInactive });
  });
}

export async function searchPatientsAction(q: string) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const term = String(q ?? "").slice(0, 80);
    if (term.trim().length < 2) return [];
    return searchPatientsForPicker(ctx, term);
  });
}
