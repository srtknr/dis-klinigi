import "server-only";
import { db, Prisma } from "@/lib/db";
import type { AuthContext } from "@/lib/auth/types";
import { errors } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { assertCan } from "@/lib/permissions/guard";
import { normalizeTrPhone } from "@/lib/phone";
import { normalizeSearch } from "@/lib/text";
import { addDaysToKey, dayRangeUtc, isDateKey, todayKey } from "@/lib/time";
import type { AppointmentFilters } from "@/lib/validations/appointment";
import { ALL_STATUSES, type AppointmentStatusKey } from "@/features/appointments/status";
import { findPatientMatches } from "@/features/patients/matching";

export const APPOINTMENTS_PAGE_SIZE = 20;

function buildWhere(ctx: AuthContext, filters: AppointmentFilters): Prisma.AppointmentWhereInput {
  const where: Prisma.AppointmentWhereInput = { clinicId: ctx.clinicId };
  if (filters.status && (ALL_STATUSES as string[]).includes(filters.status)) {
    where.status = filters.status as AppointmentStatusKey;
  }
  if (filters.dentistId) where.dentistId = filters.dentistId;
  const startsAt: Prisma.DateTimeFilter = {};
  if (filters.from && isDateKey(filters.from)) startsAt.gte = dayRangeUtc(filters.from).start;
  if (filters.to && isDateKey(filters.to)) startsAt.lt = dayRangeUtc(filters.to).end;
  if (startsAt.gte || startsAt.lt) where.startsAt = startsAt;

  const q = filters.q?.trim();
  if (q) {
    const phone = normalizeTrPhone(q);
    const digits = q.replace(/\D/g, "");
    if (phone) {
      where.OR = [{ requesterPhone: phone }, { patient: { phone } }];
    } else if (digits.length >= 4 && digits.length === q.replace(/\s/g, "").length) {
      where.OR = [{ requesterPhone: { contains: digits } }, { patient: { phone: { contains: digits } } }];
    } else {
      const term = normalizeSearch(q);
      where.OR = [
        { patient: { searchName: { contains: term } } },
        { requesterFirstName: { contains: q, mode: "insensitive" } },
        { requesterLastName: { contains: q, mode: "insensitive" } },
      ];
    }
  }
  return where;
}

const listInclude = {
  dentist: { select: { id: true, title: true, firstName: true, lastName: true } },
  patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
  service: { select: { name: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentListItem = Prisma.AppointmentGetPayload<{ include: typeof listInclude }>;

export async function listAppointments(ctx: AuthContext, filters: AppointmentFilters) {
  assertCan(ctx, "APPOINTMENT_VIEW");
  const where = buildWhere(ctx, filters);
  const page = filters.page ?? 1;
  const [items, total] = await Promise.all([
    db.appointment.findMany({
      where,
      include: listInclude,
      orderBy: [{ startsAt: filters.status === "PENDING" || !filters.from ? "desc" : "asc" }],
      skip: (page - 1) * APPOINTMENTS_PAGE_SIZE,
      take: APPOINTMENTS_PAGE_SIZE,
    }),
    db.appointment.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / APPOINTMENTS_PAGE_SIZE)) };
}

export async function getAppointmentDetail(ctx: AuthContext, appointmentId: string) {
  assertCan(ctx, "APPOINTMENT_VIEW");
  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, clinicId: ctx.clinicId },
    include: {
      dentist: { select: { id: true, title: true, firstName: true, lastName: true, slotMinutes: true } },
      patient: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      service: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      notifications: {
        orderBy: { createdAt: "desc" },
        select: { id: true, channel: true, template: true, status: true, attempts: true, lastError: true, sentAt: true, createdAt: true },
      },
      calendarEvents: {
        select: { id: true, syncStatus: true, desiredState: true, lastError: true, lastSyncedAt: true, attempts: true },
      },
      treatments: can(ctx, "TREATMENT_VIEW")
        ? { where: { status: "ACTIVE" }, select: { id: true, procedure: true, visitDate: true } }
        : false,
    },
  });
  if (!appointment) throw errors.notFound("Randevu");

  const candidates =
    !appointment.patientId && can(ctx, "PATIENT_VIEW")
      ? (
          await findPatientMatches(
            db,
            ctx.clinicId,
            appointment.requesterPhone,
            appointment.requesterFirstName,
            appointment.requesterLastName,
          )
        ).candidates
      : [];

  return { appointment, candidates };
}

export type CalendarEventDto = {
  id: string;
  title: string;
  start: string;
  end: string;
  status: AppointmentStatusKey;
  dentistId: string;
  dentistName: string;
};

export async function listCalendarEvents(
  ctx: AuthContext,
  range: { from: Date; to: Date },
  options: { dentistId?: string; includeInactive?: boolean } = {},
): Promise<CalendarEventDto[]> {
  assertCan(ctx, "APPOINTMENT_VIEW");
  const spanDays = (range.to.getTime() - range.from.getTime()) / 86_400_000;
  if (!(spanDays > 0 && spanDays <= 62)) throw errors.validation("Takvim aralığı en fazla 62 gün olabilir.");
  const rows = await db.appointment.findMany({
    where: {
      clinicId: ctx.clinicId,
      startsAt: { lt: range.to },
      endsAt: { gt: range.from },
      ...(options.dentistId ? { dentistId: options.dentistId } : {}),
      ...(options.includeInactive ? {} : { status: { notIn: ["REJECTED", "CANCELLED"] } }),
    },
    include: listInclude,
    orderBy: { startsAt: "asc" },
    take: 1000,
  });
  return rows.map((a) => ({
    id: a.id,
    title: `${a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : `${a.requesterFirstName} ${a.requesterLastName}`}${a.service ? ` · ${a.service.name}` : ""}`,
    start: a.startsAt.toISOString(),
    end: a.endsAt.toISOString(),
    status: a.status,
    dentistId: a.dentist.id,
    dentistName: `${a.dentist.title} ${a.dentist.firstName} ${a.dentist.lastName}`,
  }));
}

export async function getDashboardData(ctx: AuthContext, now = new Date()) {
  assertCan(ctx, "APPOINTMENT_VIEW");
  const today = todayKey(now);
  const todayRange = dayRangeUtc(today);
  const last30 = dayRangeUtc(addDaysToKey(today, -30)).start;
  const nextWeekEnd = dayRangeUtc(addDaysToKey(today, 7)).end;
  const clinicId = ctx.clinicId;

  const [todayCount, pendingCount, confirmedCount, completedCount, cancelledCount, todayItems, pendingItems, upcomingItems, activity] =
    await Promise.all([
      db.appointment.count({ where: { clinicId, startsAt: { gte: todayRange.start, lt: todayRange.end }, status: { notIn: ["REJECTED", "CANCELLED"] } } }),
      db.appointment.count({ where: { clinicId, status: "PENDING", startsAt: { gte: now } } }),
      db.appointment.count({ where: { clinicId, status: "CONFIRMED", startsAt: { gte: now } } }),
      db.appointment.count({ where: { clinicId, status: "COMPLETED", startsAt: { gte: last30 } } }),
      db.appointment.count({ where: { clinicId, status: "CANCELLED", updatedAt: { gte: last30 } } }),
      db.appointment.findMany({
        where: { clinicId, startsAt: { gte: todayRange.start, lt: todayRange.end }, status: { notIn: ["REJECTED", "CANCELLED"] } },
        include: listInclude,
        orderBy: { startsAt: "asc" },
        take: 12,
      }),
      db.appointment.findMany({
        where: { clinicId, status: "PENDING", startsAt: { gte: now } },
        include: listInclude,
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      db.appointment.findMany({
        where: { clinicId, status: "CONFIRMED", startsAt: { gte: todayRange.end, lt: nextWeekEnd } },
        include: listInclude,
        orderBy: { startsAt: "asc" },
        take: 8,
      }),
      db.appointmentStatusHistory.findMany({
        where: { appointment: { clinicId } },
        include: {
          changedBy: { select: { name: true } },
          appointment: { select: { id: true, requesterFirstName: true, requesterLastName: true, startsAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

  const recentPatients = can(ctx, "PATIENT_VIEW")
    ? await db.patient.findMany({
        where: { clinicId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, firstName: true, lastName: true, createdAt: true },
      })
    : null;

  return {
    stats: { todayCount, pendingCount, confirmedCount, completedCount, cancelledCount },
    todayItems,
    pendingItems,
    upcomingItems,
    activity,
    recentPatients,
  };
}
