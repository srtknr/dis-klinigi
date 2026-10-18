import "server-only";
import { db, isExclusionViolation, type Tx } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/types";
import { AppError, errors, SLOT_TAKEN_MESSAGE } from "@/lib/errors";
import { requestCalendarSync } from "@/lib/google-calendar/sync";
import type { GoogleDeps } from "@/lib/google-calendar/client";
import { enqueueAppointmentNotifications } from "@/lib/notifications/outbox";
import { assertCan } from "@/lib/permissions/guard";
import { normalizeTrPhone } from "@/lib/phone";
import { titleCaseTr } from "@/lib/text";
import { dateKeyInTz, hhmmToMinutes, todayKey, zonedTimeToUtc } from "@/lib/time";
import { emptyToUndefined } from "@/lib/validations/common";
import {
  adminAppointmentSchema,
  appointmentNoteSchema,
  confirmSchema,
  PRIVACY_NOTICE_VERSION,
  publicAppointmentSchema,
  rescheduleSchema,
  statusReasonSchema,
} from "@/lib/validations/appointment";
import type { NotificationTemplate } from "@/generated/prisma/enums";
import { fitsSchedule } from "@/features/calendar/availability";
import { ACTIVE_APPOINTMENT_STATUSES, getAvailability, getDaySchedule } from "@/features/calendar/service";
import { APPOINTMENT_STATUS_LABELS, canTransition, type AppointmentAction, type AppointmentStatusKey } from "@/features/appointments/status";
import { buildSearchName, findPatientMatches } from "@/features/patients/matching";

/** Aynı hekim için eşzamanlı randevu işlemlerini transaction süresince sıraya sokar */
async function lockDentist(tx: Tx, dentistId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dentist:${dentistId}`}))`;
}

async function assertNoOverlap(
  tx: Tx,
  dentistId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
): Promise<void> {
  const clash = await tx.appointment.findFirst({
    where: {
      dentistId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw errors.conflict(SLOT_TAKEN_MESSAGE);
}

async function assertNotBlocked(tx: Tx, dentistId: string, startsAt: Date, endsAt: Date): Promise<void> {
  const blocked = await tx.blockedTime.findFirst({
    where: { dentistId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    select: { id: true },
  });
  if (blocked) {
    throw errors.conflict("Seçilen saat doktorun izinli veya randevuya kapalı olduğu zamana denk geliyor.");
  }
}

/** Exclusion constraint ihlalini kullanıcı dostu çakışma hatasına çevirir */
async function withConflictGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isExclusionViolation(error)) throw errors.conflict(SLOT_TAKEN_MESSAGE);
    throw error;
  }
}

// ───────────────────────── Online randevu talebi ─────────────────────────

export type PublicRequestMeta = { clinicId: string; ipHash: string | null; now?: Date; googleDeps?: GoogleDeps };

/**
 * Herkese açık randevu talebi. Talep her zaman PENDING oluşturulur; admin onayına kadar kesinleşmez.
 * Akış: doğrulama → sunucu tarafı müsaitlik hesabı → transaction (advisory lock + çakışma kontrolü
 * + DB exclusion constraint) → admin bildirimi outbox'a.
 */
export async function createPublicAppointmentRequest(raw: unknown, meta: PublicRequestMeta): Promise<{ appointmentId: string }> {
  const input = publicAppointmentSchema.parse(raw);
  if (input.website) throw errors.validation("Talep doğrulanamadı.");
  const now = meta.now ?? new Date();
  const phone = normalizeTrPhone(input.phone)!;
  const serviceId = emptyToUndefined(input.serviceId);

  const dentist = await db.dentistProfile.findFirst({
    where: { id: input.dentistId, clinicId: meta.clinicId, isActive: true, acceptsOnlineBooking: true },
    select: { id: true },
  });
  if (!dentist) throw errors.validation("Seçilen doktor online randevu kabul etmiyor.", { dentistId: ["Geçerli bir doktor seçin."] });

  let serviceName: string | null = null;
  if (serviceId) {
    const service = await db.service.findFirst({ where: { id: serviceId, clinicId: meta.clinicId, isActive: true } });
    if (!service) throw errors.validation("Seçilen hizmet bulunamadı.", { serviceId: ["Geçerli bir hizmet seçin."] });
    serviceName = service.name;
  }

  const availability = await getAvailability({
    clinicId: meta.clinicId,
    dentistId: dentist.id,
    dateKey: input.date,
    mode: "public",
    now,
    googleDeps: meta.googleDeps,
  });
  const slot = availability.slots.find((s) => s.time === input.startTime);
  if (!slot) throw errors.conflict(SLOT_TAKEN_MESSAGE);
  const startsAt = new Date(slot.start);
  const endsAt = new Date(slot.end);

  const appointment = await withConflictGuard(() =>
    db.$transaction(async (tx) => {
      await lockDentist(tx, dentist.id);
      await assertNoOverlap(tx, dentist.id, startsAt, endsAt);

      const openRequests = await tx.appointment.count({
        where: { clinicId: meta.clinicId, requesterPhone: phone, status: "PENDING", startsAt: { gt: now } },
      });
      if (openRequests >= 3) {
        throw errors.validation("Bu telefon numarasıyla onay bekleyen birden fazla talebiniz var. Lütfen kliniğimizi arayın.");
      }

      const firstName = titleCaseTr(input.firstName);
      const lastName = titleCaseTr(input.lastName);
      const { exact } = await findPatientMatches(tx, meta.clinicId, phone, firstName, lastName);

      const created = await tx.appointment.create({
        data: {
          clinicId: meta.clinicId,
          dentistId: dentist.id,
          patientId: exact?.id ?? null,
          serviceId: serviceId ?? null,
          startsAt,
          endsAt,
          status: "PENDING",
          source: "PUBLIC_WEBSITE",
          requesterFirstName: firstName,
          requesterLastName: lastName,
          requesterPhone: phone,
          requesterEmail: emptyToUndefined(input.email)?.toLowerCase() ?? null,
          reason: serviceName,
          patientMessage: emptyToUndefined(input.message) ?? null,
          privacyNoticeAckAt: now,
          privacyNoticeVer: PRIVACY_NOTICE_VERSION,
          explicitConsentAt: input.explicitConsent ? now : null,
        },
      });
      const history = await tx.appointmentStatusHistory.create({
        data: { appointmentId: created.id, toStatus: "PENDING", event: "REQUESTED" },
      });
      await enqueueAppointmentNotifications(tx, {
        appointmentId: created.id,
        template: "ADMIN_NEW_REQUEST",
        eventKey: history.id,
      });
      await writeAudit(tx, {
        clinicId: meta.clinicId,
        action: "appointment.requested",
        entityType: "Appointment",
        entityId: created.id,
        ipHash: meta.ipHash,
        metadata: { dentistId: dentist.id, matchedPatient: Boolean(exact) },
      });
      return created;
    }),
  );
  return { appointmentId: appointment.id };
}

// ───────────────────────── Panelden randevu oluşturma ─────────────────────────

type SlotCheck = {
  dentistId: string;
  dateKey: string;
  startTime: string;
  durationMinutes: number;
  overrideSchedule: boolean;
};

async function resolveTimes(check: SlotCheck): Promise<{ startsAt: Date; endsAt: Date }> {
  const startMinute = hhmmToMinutes(check.startTime)!;
  const endMinute = startMinute + check.durationMinutes;
  if (endMinute > 24 * 60) throw errors.validation("Randevu gün sonunu aşamaz.");
  if (!check.overrideSchedule) {
    const schedule = await getDaySchedule(db, check.dentistId, check.dateKey);
    if (!fitsSchedule(schedule, startMinute, endMinute)) {
      throw errors.validation(
        "Seçilen saat doktorun çalışma saatleri dışında veya mola saatine denk geliyor. Gerekirse 'Çalışma saati dışında' seçeneğini işaretleyin.",
        { startTime: ["Çalışma saatleri dışında"] },
      );
    }
  }
  return {
    startsAt: zonedTimeToUtc(check.dateKey, startMinute),
    endsAt: zonedTimeToUtc(check.dateKey, endMinute),
  };
}

export async function createAdminAppointment(ctx: AuthContext, raw: unknown): Promise<{ appointmentId: string }> {
  assertCan(ctx, "APPOINTMENT_CREATE");
  const input = adminAppointmentSchema.parse(raw);
  if (input.confirmNow) assertCan(ctx, "APPOINTMENT_APPROVE");

  const dentist = await db.dentistProfile.findFirst({
    where: { id: input.dentistId, clinicId: ctx.clinicId, isActive: true },
    select: { id: true, slotMinutes: true },
  });
  if (!dentist) throw errors.validation("Geçerli bir doktor seçin.", { dentistId: ["Doktor bulunamadı."] });

  const serviceId = emptyToUndefined(input.serviceId);
  const service = serviceId
    ? await db.service.findFirst({ where: { id: serviceId, clinicId: ctx.clinicId } })
    : null;
  if (serviceId && !service) throw errors.validation("Seçilen hizmet bulunamadı.");

  const duration = input.durationMinutes ?? service?.durationMinutes ?? dentist.slotMinutes;
  const { startsAt, endsAt } = await resolveTimes({
    dentistId: dentist.id,
    dateKey: input.date,
    startTime: input.startTime,
    durationMinutes: duration,
    overrideSchedule: Boolean(input.overrideSchedule),
  });

  let existingPatient: { id: string; firstName: string; lastName: string; phone: string; email: string | null } | null = null;
  if (input.patient.mode === "existing") {
    assertCan(ctx, "PATIENT_VIEW");
    existingPatient = await db.patient.findFirst({
      where: { id: input.patient.patientId, clinicId: ctx.clinicId },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    });
    if (!existingPatient) throw errors.notFound("Hasta");
  } else {
    assertCan(ctx, "PATIENT_MANAGE");
    const phone = normalizeTrPhone(input.patient.phone)!;
    const { candidates } = await findPatientMatches(db, ctx.clinicId, phone);
    if (candidates.length > 0) {
      throw new AppError(
        "DUPLICATE_PATIENT",
        "Bu telefon numarasıyla kayıtlı hasta(lar) var. Lütfen mevcut hastayı seçin veya bilgileri kontrol edin.",
        undefined,
        { candidates: candidates.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })) },
      );
    }
  }

  const status: AppointmentStatusKey = input.confirmNow ? "CONFIRMED" : "PENDING";
  const appointment = await withConflictGuard(() =>
    db.$transaction(async (tx) => {
      await lockDentist(tx, dentist.id);
      await assertNoOverlap(tx, dentist.id, startsAt, endsAt);
      if (!input.overrideSchedule) await assertNotBlocked(tx, dentist.id, startsAt, endsAt);

      let patient = existingPatient;
      if (!patient && input.patient.mode === "new") {
        const firstName = titleCaseTr(input.patient.firstName);
        const lastName = titleCaseTr(input.patient.lastName);
        patient = await tx.patient.create({
          data: {
            clinicId: ctx.clinicId,
            firstName,
            lastName,
            searchName: buildSearchName(firstName, lastName),
            phone: normalizeTrPhone(input.patient.phone)!,
            email: emptyToUndefined(input.patient.email)?.toLowerCase() ?? null,
            createdById: ctx.userId,
          },
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        });
        await writeAudit(tx, { ctx, action: "patient.created", entityType: "Patient", entityId: patient.id });
      }
      if (!patient) throw errors.validation("Hasta bilgisi eksik.");

      const created = await tx.appointment.create({
        data: {
          clinicId: ctx.clinicId,
          dentistId: dentist.id,
          patientId: patient.id,
          serviceId: service?.id ?? null,
          startsAt,
          endsAt,
          status,
          source: "ADMIN_PANEL",
          requesterFirstName: patient.firstName,
          requesterLastName: patient.lastName,
          requesterPhone: patient.phone,
          requesterEmail: patient.email,
          reason: emptyToUndefined(input.reason) ?? service?.name ?? null,
          createdById: ctx.userId,
        },
      });
      const history = await tx.appointmentStatusHistory.create({
        data: { appointmentId: created.id, toStatus: status, event: "CREATED", changedById: ctx.userId },
      });
      if (status === "CONFIRMED") {
        await enqueueAppointmentNotifications(tx, { appointmentId: created.id, template: "PATIENT_CONFIRMED", eventKey: history.id });
        await requestCalendarSync(tx, created.id);
      }
      await writeAudit(tx, {
        ctx,
        action: "appointment.created",
        entityType: "Appointment",
        entityId: created.id,
        metadata: { status, overrideSchedule: Boolean(input.overrideSchedule) },
      });
      return created;
    }),
  );
  return { appointmentId: appointment.id };
}

// ───────────────────────── Durum geçişleri ─────────────────────────

type TransitionOptions = {
  action: AppointmentAction;
  to: AppointmentStatusKey;
  event: string;
  auditAction: string;
  note?: string;
  template?: NotificationTemplate;
  syncCalendar: boolean;
  before?: (tx: Tx, appt: { id: string; startsAt: Date; patientId: string | null; requesterPhone: string; requesterFirstName: string; requesterLastName: string; requesterEmail: string | null }) => Promise<Record<string, unknown> | void>;
};

async function transition(ctx: AuthContext, appointmentId: string, opts: TransitionOptions): Promise<{ appointmentId: string }> {
  await db.$transaction(async (tx) => {
    const appt = await tx.appointment.findFirst({ where: { id: appointmentId, clinicId: ctx.clinicId } });
    if (!appt) throw errors.notFound("Randevu");
    if (!canTransition(opts.action, appt.status)) {
      throw errors.invalidState(`Randevu "${APPOINTMENT_STATUS_LABELS[appt.status]}" durumunda olduğu için bu işlem yapılamaz.`);
    }
    const extra = (await opts.before?.(tx, appt)) ?? {};
    // İyimser eşzamanlılık: durum bu arada değiştiyse güncelleme yapılmaz
    const updated = await tx.appointment.updateMany({
      where: { id: appt.id, status: appt.status },
      data: { status: opts.to, statusReason: opts.note ?? null, ...extra },
    });
    if (updated.count !== 1) throw errors.conflict("Randevu başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyin.");

    const history = await tx.appointmentStatusHistory.create({
      data: {
        appointmentId: appt.id,
        fromStatus: appt.status,
        toStatus: opts.to,
        event: opts.event,
        note: opts.note ?? null,
        changedById: ctx.userId,
      },
    });
    if (opts.template) {
      await enqueueAppointmentNotifications(tx, { appointmentId: appt.id, template: opts.template, eventKey: history.id });
    }
    if (opts.syncCalendar) await requestCalendarSync(tx, appt.id);
    await writeAudit(tx, {
      ctx,
      action: opts.auditAction,
      entityType: "Appointment",
      entityId: appt.id,
      metadata: { from: appt.status, to: opts.to },
    });
  });
  return { appointmentId };
}

/**
 * Talebi onaylar. Randevu bir hasta kaydına bağlı değilse:
 * - patientId verilmişse o hasta ile eşleştirir,
 * - createNewPatient=true ise yeni hasta oluşturur,
 * - aynı telefonla kayıtlı aday yoksa otomatik yeni hasta oluşturur,
 * - aday(lar) varsa kullanıcının seçim yapması istenir (otomatik birleştirme yapılmaz).
 */
export async function confirmAppointment(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "APPOINTMENT_APPROVE");
  const input = confirmSchema.parse(raw);
  return transition(ctx, input.appointmentId, {
    action: "confirm",
    to: "CONFIRMED",
    event: "CONFIRMED",
    auditAction: "appointment.confirmed",
    note: emptyToUndefined(input.note),
    template: "PATIENT_CONFIRMED",
    syncCalendar: true,
    before: async (tx, appt) => {
      if (appt.patientId) return;
      const patientId = emptyToUndefined(input.patientId);
      if (patientId) {
        const patient = await tx.patient.findFirst({ where: { id: patientId, clinicId: ctx.clinicId }, select: { id: true } });
        if (!patient) throw errors.notFound("Hasta");
        return { patientId: patient.id };
      }
      const { candidates } = await findPatientMatches(tx, ctx.clinicId, appt.requesterPhone);
      if (candidates.length > 0 && !input.createNewPatient) {
        throw new AppError(
          "PATIENT_MATCH_REQUIRED",
          "Bu telefonla kayıtlı hasta(lar) bulundu. Onaylamadan önce mevcut hastayı seçin veya yeni hasta oluşturun.",
        );
      }
      assertCan(ctx, "PATIENT_MANAGE");
      const created = await tx.patient.create({
        data: {
          clinicId: ctx.clinicId,
          firstName: appt.requesterFirstName,
          lastName: appt.requesterLastName,
          searchName: buildSearchName(appt.requesterFirstName, appt.requesterLastName),
          phone: appt.requesterPhone,
          email: appt.requesterEmail,
          createdById: ctx.userId,
        },
      });
      await writeAudit(tx, { ctx, action: "patient.created", entityType: "Patient", entityId: created.id, metadata: { fromAppointment: appt.id } });
      return { patientId: created.id };
    },
  });
}

export async function rejectAppointment(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "APPOINTMENT_APPROVE");
  const input = statusReasonSchema.parse(raw);
  return transition(ctx, input.appointmentId, {
    action: "reject",
    to: "REJECTED",
    event: "REJECTED",
    auditAction: "appointment.rejected",
    note: emptyToUndefined(input.reason),
    template: "PATIENT_REJECTED",
    syncCalendar: true,
  });
}

export async function cancelAppointment(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "APPOINTMENT_EDIT");
  const input = statusReasonSchema.parse(raw);
  return transition(ctx, input.appointmentId, {
    action: "cancel",
    to: "CANCELLED",
    event: "CANCELLED",
    auditAction: "appointment.cancelled",
    note: emptyToUndefined(input.reason),
    template: "PATIENT_CANCELLED",
    syncCalendar: true,
  });
}

export async function completeAppointment(ctx: AuthContext, raw: unknown, now = new Date()) {
  assertCan(ctx, "APPOINTMENT_EDIT");
  const input = statusReasonSchema.parse(raw);
  return transition(ctx, input.appointmentId, {
    action: "complete",
    to: "COMPLETED",
    event: "COMPLETED",
    auditAction: "appointment.completed",
    note: emptyToUndefined(input.reason),
    syncCalendar: false,
    before: async (_tx, appt) => {
      if (dateKeyInTz(appt.startsAt) > todayKey(now)) {
        throw errors.invalidState("İleri tarihli bir randevu tamamlandı olarak işaretlenemez.");
      }
    },
  });
}

export async function markNoShow(ctx: AuthContext, raw: unknown, now = new Date()) {
  assertCan(ctx, "APPOINTMENT_EDIT");
  const input = statusReasonSchema.parse(raw);
  return transition(ctx, input.appointmentId, {
    action: "no_show",
    to: "NO_SHOW",
    event: "NO_SHOW",
    auditAction: "appointment.no_show",
    note: emptyToUndefined(input.reason),
    syncCalendar: true,
    before: async (_tx, appt) => {
      if (appt.startsAt > now) throw errors.invalidState("Randevu saati gelmeden 'gelmedi' olarak işaretlenemez.");
    },
  });
}

// ───────────────────────── Yeniden planlama ─────────────────────────

export async function rescheduleAppointment(ctx: AuthContext, raw: unknown): Promise<{ appointmentId: string }> {
  assertCan(ctx, "APPOINTMENT_EDIT");
  const input = rescheduleSchema.parse(raw);

  const current = await db.appointment.findFirst({
    where: { id: input.appointmentId, clinicId: ctx.clinicId },
    include: { service: { select: { durationMinutes: true } } },
  });
  if (!current) throw errors.notFound("Randevu");
  if (!canTransition("reschedule", current.status)) {
    throw errors.invalidState(`Randevu "${APPOINTMENT_STATUS_LABELS[current.status]}" durumunda olduğu için yeniden planlanamaz.`);
  }
  const dentist = await db.dentistProfile.findFirst({
    where: { id: input.dentistId, clinicId: ctx.clinicId, isActive: true },
    select: { id: true },
  });
  if (!dentist) throw errors.validation("Geçerli bir doktor seçin.");

  const currentDuration = Math.round((current.endsAt.getTime() - current.startsAt.getTime()) / 60_000);
  const { startsAt, endsAt } = await resolveTimes({
    dentistId: dentist.id,
    dateKey: input.date,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes ?? currentDuration,
    overrideSchedule: Boolean(input.overrideSchedule),
  });

  await withConflictGuard(() =>
    db.$transaction(async (tx) => {
      await lockDentist(tx, dentist.id);
      await assertNoOverlap(tx, dentist.id, startsAt, endsAt, current.id);
      if (!input.overrideSchedule) await assertNotBlocked(tx, dentist.id, startsAt, endsAt);

      const updated = await tx.appointment.updateMany({
        where: { id: current.id, status: current.status, updatedAt: current.updatedAt },
        data: { dentistId: dentist.id, startsAt, endsAt },
      });
      if (updated.count !== 1) throw errors.conflict("Randevu başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyin.");

      const history = await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: current.id,
          fromStatus: current.status,
          toStatus: current.status,
          event: "RESCHEDULED",
          note: emptyToUndefined(input.note) ?? null,
          changedById: ctx.userId,
        },
      });
      if (current.status === "CONFIRMED") {
        await enqueueAppointmentNotifications(tx, { appointmentId: current.id, template: "PATIENT_RESCHEDULED", eventKey: history.id });
      }
      await requestCalendarSync(tx, current.id);
      await writeAudit(tx, {
        ctx,
        action: "appointment.rescheduled",
        entityType: "Appointment",
        entityId: current.id,
        metadata: {
          from: { dentistId: current.dentistId, startsAt: current.startsAt.toISOString() },
          to: { dentistId: dentist.id, startsAt: startsAt.toISOString() },
        },
      });
    }),
  );
  return { appointmentId: current.id };
}

// ───────────────────────── Notlar & hasta eşleştirme ─────────────────────────

export async function addAppointmentNote(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "APPOINTMENT_EDIT");
  const input = appointmentNoteSchema.parse(raw);
  const appt = await db.appointment.findFirst({ where: { id: input.appointmentId, clinicId: ctx.clinicId }, select: { id: true } });
  if (!appt) throw errors.notFound("Randevu");
  const note = await db.appointmentNote.create({
    data: { appointmentId: appt.id, authorId: ctx.userId, body: input.body },
  });
  await writeAudit(db, { ctx, action: "appointment.note_added", entityType: "Appointment", entityId: appt.id });
  return { noteId: note.id };
}

export async function linkAppointmentPatient(ctx: AuthContext, appointmentId: string, patientId: string) {
  assertCan(ctx, "APPOINTMENT_EDIT", "PATIENT_VIEW");
  return db.$transaction(async (tx) => {
    const appt = await tx.appointment.findFirst({ where: { id: appointmentId, clinicId: ctx.clinicId } });
    if (!appt) throw errors.notFound("Randevu");
    const patient = await tx.patient.findFirst({ where: { id: patientId, clinicId: ctx.clinicId }, select: { id: true } });
    if (!patient) throw errors.notFound("Hasta");
    await tx.appointment.update({ where: { id: appt.id }, data: { patientId: patient.id } });
    await tx.appointmentStatusHistory.create({
      data: { appointmentId: appt.id, fromStatus: appt.status, toStatus: appt.status, event: "PATIENT_LINKED", changedById: ctx.userId },
    });
    await writeAudit(tx, { ctx, action: "appointment.patient_linked", entityType: "Appointment", entityId: appt.id, metadata: { patientId } });
    return { appointmentId: appt.id };
  });
}
