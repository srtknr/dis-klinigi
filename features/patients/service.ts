import "server-only";
import { db, Prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/types";
import { AppError, errors } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { assertCan } from "@/lib/permissions/guard";
import { normalizeTrPhone } from "@/lib/phone";
import { normalizeSearch, titleCaseTr } from "@/lib/text";
import { dateKeyToDateOnly } from "@/lib/time";
import { emptyToUndefined } from "@/lib/validations/common";
import { patientNoteSchema, patientSchema, patientUpdateSchema } from "@/lib/validations/patient";
import { buildSearchName, findPatientMatches } from "@/features/patients/matching";
import { listTreatmentHistory } from "@/features/treatments/service";

export const PATIENTS_PAGE_SIZE = 20;

export async function listPatients(ctx: AuthContext, params: { q?: string; page?: number }) {
  assertCan(ctx, "PATIENT_VIEW");
  const where: Prisma.PatientWhereInput = { clinicId: ctx.clinicId };
  const q = params.q?.trim();
  if (q) {
    const phone = normalizeTrPhone(q);
    const digits = q.replace(/\D/g, "");
    if (phone) where.phone = phone;
    else if (digits.length >= 4 && digits.length === q.replace(/\s/g, "").length) where.phone = { contains: digits };
    else where.searchName = { contains: normalizeSearch(q) };
  }
  const page = params.page ?? 1;
  const [items, total] = await Promise.all([
    db.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PATIENTS_PAGE_SIZE,
      take: PATIENTS_PAGE_SIZE,
      include: {
        appointments: {
          orderBy: { startsAt: "desc" },
          take: 1,
          select: { startsAt: true, status: true },
        },
      },
    }),
    db.patient.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PATIENTS_PAGE_SIZE)) };
}

export async function searchPatientsForPicker(ctx: AuthContext, q: string) {
  assertCan(ctx, "PATIENT_VIEW");
  const { items } = await listPatients(ctx, { q, page: 1 });
  return items.slice(0, 8).map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, phone: p.phone }));
}

export async function createPatient(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "PATIENT_MANAGE");
  const input = patientSchema.parse(raw);
  const phone = normalizeTrPhone(input.phone)!;
  const firstName = titleCaseTr(input.firstName);
  const lastName = titleCaseTr(input.lastName);

  const { candidates } = await findPatientMatches(db, ctx.clinicId, phone);
  if (candidates.length > 0 && !input.confirmDuplicate) {
    throw new AppError(
      "DUPLICATE_PATIENT",
      "Bu telefon numarasıyla kayıtlı hasta bulundu. Mevcut kaydı kullanabilir veya farklı bir kişi olduğunu onaylayarak yeni kayıt oluşturabilirsiniz.",
      undefined,
      { candidates: candidates.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })) },
    );
  }

  return db.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        clinicId: ctx.clinicId,
        firstName,
        lastName,
        searchName: buildSearchName(firstName, lastName),
        phone,
        email: emptyToUndefined(input.email)?.toLowerCase() ?? null,
        birthDate: input.birthDate ? dateKeyToDateOnly(input.birthDate) : null,
        createdById: ctx.userId,
      },
    });
    await writeAudit(tx, { ctx, action: "patient.created", entityType: "Patient", entityId: patient.id });
    return { patientId: patient.id };
  });
}

export async function updatePatient(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "PATIENT_MANAGE");
  const input = patientUpdateSchema.parse(raw);
  const existing = await db.patient.findFirst({ where: { id: input.patientId, clinicId: ctx.clinicId } });
  if (!existing) throw errors.notFound("Hasta");

  const phone = normalizeTrPhone(input.phone)!;
  if (phone !== existing.phone && !input.confirmDuplicate) {
    const { candidates } = await findPatientMatches(db, ctx.clinicId, phone);
    const others = candidates.filter((c) => c.id !== existing.id);
    if (others.length > 0) {
      throw new AppError(
        "DUPLICATE_PATIENT",
        "Yeni telefon numarası başka bir hasta kaydında kullanılıyor. Devam etmek için onaylayın.",
        undefined,
        { candidates: others.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })) },
      );
    }
  }
  const firstName = titleCaseTr(input.firstName);
  const lastName = titleCaseTr(input.lastName);
  const data = {
    firstName,
    lastName,
    searchName: buildSearchName(firstName, lastName),
    phone,
    email: emptyToUndefined(input.email)?.toLowerCase() ?? null,
    birthDate: input.birthDate ? dateKeyToDateOnly(input.birthDate) : null,
  };
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
    (k) => String(existing[k] ?? "") !== String(data[k] ?? ""),
  );
  await db.$transaction(async (tx) => {
    await tx.patient.update({ where: { id: existing.id }, data });
    await writeAudit(tx, { ctx, action: "patient.updated", entityType: "Patient", entityId: existing.id, metadata: { changedFields: changed } });
  });
  return { patientId: existing.id };
}

export async function addPatientNote(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "PATIENT_MANAGE");
  const input = patientNoteSchema.parse(raw);
  const patient = await db.patient.findFirst({ where: { id: input.patientId, clinicId: ctx.clinicId }, select: { id: true } });
  if (!patient) throw errors.notFound("Hasta");
  await db.patientNote.create({
    data: { clinicId: ctx.clinicId, patientId: patient.id, authorId: ctx.userId, body: input.body },
  });
  await writeAudit(db, { ctx, action: "patient.note_added", entityType: "Patient", entityId: patient.id });
  return { patientId: patient.id };
}

export async function getPatientForEdit(ctx: AuthContext, patientId: string) {
  assertCan(ctx, "PATIENT_MANAGE");
  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: ctx.clinicId } });
  if (!patient) throw errors.notFound("Hasta");
  return patient;
}

/**
 * Hasta detay sayfası verisi. Muayene geçmişi yalnızca TREATMENT_VIEW izniyle döner ve
 * görüntüleme denetim kaydına yazılır.
 */
export async function getPatientDetail(ctx: AuthContext, patientId: string, now = new Date()) {
  assertCan(ctx, "PATIENT_VIEW");
  const patient = await db.patient.findFirst({
    where: { id: patientId, clinicId: ctx.clinicId },
    include: {
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      appointments: {
        orderBy: { startsAt: "desc" },
        include: {
          dentist: { select: { title: true, firstName: true, lastName: true } },
          service: { select: { name: true } },
        },
      },
    },
  });
  if (!patient) throw errors.notFound("Hasta");

  const upcoming = patient.appointments
    .filter((a) => a.startsAt >= now && (a.status === "PENDING" || a.status === "CONFIRMED"))
    .reverse();
  const past = patient.appointments.filter((a) => !upcoming.includes(a));

  let treatments: Awaited<ReturnType<typeof listTreatmentHistory>> | null = null;
  if (can(ctx, "TREATMENT_VIEW")) {
    treatments = await listTreatmentHistory(ctx, patient.id);
    await writeAudit(db, { ctx, action: "patient.viewed_clinical", entityType: "Patient", entityId: patient.id });
  }
  return { patient, upcoming, past, treatments };
}
