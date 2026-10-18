import "server-only";
import { db, Prisma, type Tx } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/types";
import { errors } from "@/lib/errors";
import { assertCan, assertOwner } from "@/lib/permissions/guard";
import { dateKeyToDateOnly, dateOnlyToKey } from "@/lib/time";
import { emptyToUndefined } from "@/lib/validations/common";
import { treatmentRecordSchema, treatmentUpdateSchema, treatmentVoidSchema } from "@/lib/validations/treatment";

const userName = { select: { id: true, name: true } } as const;

const historyInclude = {
  dentist: { select: { id: true, title: true, firstName: true, lastName: true } },
  appointment: { select: { id: true, startsAt: true, status: true } },
  createdBy: userName,
  updatedBy: userName,
  voidedBy: userName,
  revisions: { orderBy: { version: "desc" }, include: { editedBy: userName } },
} satisfies Prisma.TreatmentRecordInclude;

export type TreatmentHistoryItem = Prisma.TreatmentRecordGetPayload<{ include: typeof historyInclude }>;

/** Kronolojik muayene geçmişi: en yeni ziyaret en üstte; aynı gün içinde oluşturulma sırasına göre */
export async function listTreatmentHistory(ctx: AuthContext, patientId: string): Promise<TreatmentHistoryItem[]> {
  assertCan(ctx, "TREATMENT_VIEW");
  return db.treatmentRecord.findMany({
    where: { clinicId: ctx.clinicId, patientId },
    include: historyInclude,
    orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
  });
}

async function validateRelations(
  tx: Tx,
  ctx: AuthContext,
  input: { patientId: string; dentistId: string; appointmentId?: string },
) {
  const [patient, dentist] = await Promise.all([
    tx.patient.findFirst({ where: { id: input.patientId, clinicId: ctx.clinicId }, select: { id: true } }),
    tx.dentistProfile.findFirst({ where: { id: input.dentistId, clinicId: ctx.clinicId }, select: { id: true } }),
  ]);
  if (!patient) throw errors.notFound("Hasta");
  if (!dentist) throw errors.validation("Geçerli bir doktor seçin.", { dentistId: ["Doktor bulunamadı."] });
  if (input.appointmentId) {
    const appt = await tx.appointment.findFirst({
      where: { id: input.appointmentId, clinicId: ctx.clinicId, patientId: patient.id },
      select: { id: true },
    });
    if (!appt) throw errors.validation("Seçilen randevu bu hastaya ait değil.", { appointmentId: ["Geçersiz randevu."] });
  }
}

export async function createTreatmentRecord(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "TREATMENT_MANAGE");
  const input = treatmentRecordSchema.parse(raw);
  const appointmentId = emptyToUndefined(input.appointmentId);
  return db.$transaction(async (tx) => {
    await validateRelations(tx, ctx, { patientId: input.patientId, dentistId: input.dentistId, appointmentId });
    const record = await tx.treatmentRecord.create({
      data: {
        clinicId: ctx.clinicId,
        patientId: input.patientId,
        dentistId: input.dentistId,
        appointmentId: appointmentId ?? null,
        visitDate: dateKeyToDateOnly(input.visitDate),
        procedure: input.procedure,
        examinationNote: emptyToUndefined(input.examinationNote) ?? null,
        nextVisitPlan: emptyToUndefined(input.nextVisitPlan) ?? null,
        nextVisitTodo: emptyToUndefined(input.nextVisitTodo) ?? null,
        createdById: ctx.userId,
      },
    });
    await writeAudit(tx, {
      ctx,
      action: "treatment.created",
      entityType: "TreatmentRecord",
      entityId: record.id,
      metadata: { patientId: input.patientId },
    });
    return { recordId: record.id, patientId: input.patientId };
  });
}

const SNAPSHOT_FIELDS = ["dentistId", "appointmentId", "visitDate", "procedure", "examinationNote", "nextVisitPlan", "nextVisitTodo"] as const;

/**
 * Düzeltme iş akışı: kayıt silinmez/üzerine yazılmadan önce önceki hali revizyon olarak saklanır.
 * Her düzeltme için gerekçe zorunludur; denetim kaydına değişen alan adları yazılır (içerik yazılmaz).
 */
export async function updateTreatmentRecord(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "TREATMENT_MANAGE");
  const input = treatmentUpdateSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const record = await tx.treatmentRecord.findFirst({ where: { id: input.recordId, clinicId: ctx.clinicId } });
    if (!record) throw errors.notFound("Muayene kaydı");
    if (record.status !== "ACTIVE") throw errors.invalidState("Geçersiz kılınmış kayıt düzenlenemez.");
    const appointmentId = emptyToUndefined(input.appointmentId);
    await validateRelations(tx, ctx, { patientId: record.patientId, dentistId: input.dentistId, appointmentId });

    const next = {
      dentistId: input.dentistId,
      appointmentId: appointmentId ?? null,
      visitDate: dateKeyToDateOnly(input.visitDate),
      procedure: input.procedure,
      examinationNote: emptyToUndefined(input.examinationNote) ?? null,
      nextVisitPlan: emptyToUndefined(input.nextVisitPlan) ?? null,
      nextVisitTodo: emptyToUndefined(input.nextVisitTodo) ?? null,
    };
    const snapshot = Object.fromEntries(
      SNAPSHOT_FIELDS.map((f) => [f, f === "visitDate" ? dateOnlyToKey(record.visitDate) : record[f]]),
    );
    const changedFields = SNAPSHOT_FIELDS.filter((f) =>
      f === "visitDate" ? dateOnlyToKey(record.visitDate) !== input.visitDate : (record[f] ?? null) !== (next[f] ?? null),
    );
    if (changedFields.length === 0) throw errors.validation("Kayıtta değişiklik yapılmadı.");

    const lastVersion = await tx.treatmentRecordRevision.aggregate({ where: { recordId: record.id }, _max: { version: true } });
    await tx.treatmentRecordRevision.create({
      data: {
        recordId: record.id,
        version: (lastVersion._max.version ?? 0) + 1,
        snapshot: snapshot as Prisma.InputJsonValue,
        changeReason: input.changeReason,
        editedById: ctx.userId,
      },
    });
    await tx.treatmentRecord.update({ where: { id: record.id }, data: { ...next, updatedById: ctx.userId } });
    await writeAudit(tx, {
      ctx,
      action: "treatment.updated",
      entityType: "TreatmentRecord",
      entityId: record.id,
      metadata: { patientId: record.patientId, changedFields },
    });
    return { recordId: record.id, patientId: record.patientId };
  });
}

/** Kalıcı silme yoktur. Hatalı kayıtlar yalnızca klinik sahibi tarafından gerekçeyle geçersiz kılınır. */
export async function voidTreatmentRecord(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "TREATMENT_MANAGE");
  assertOwner(ctx);
  const input = treatmentVoidSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const record = await tx.treatmentRecord.findFirst({ where: { id: input.recordId, clinicId: ctx.clinicId } });
    if (!record) throw errors.notFound("Muayene kaydı");
    if (record.status === "VOIDED") throw errors.invalidState("Kayıt zaten geçersiz kılınmış.");
    await tx.treatmentRecord.update({
      where: { id: record.id },
      data: { status: "VOIDED", voidReason: input.reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    await writeAudit(tx, {
      ctx,
      action: "treatment.voided",
      entityType: "TreatmentRecord",
      entityId: record.id,
      metadata: { patientId: record.patientId },
    });
    return { recordId: record.id, patientId: record.patientId };
  });
}

export async function getTreatmentRecordForEdit(ctx: AuthContext, recordId: string) {
  assertCan(ctx, "TREATMENT_MANAGE");
  const record = await db.treatmentRecord.findFirst({
    where: { id: recordId, clinicId: ctx.clinicId },
    include: { patient: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!record) throw errors.notFound("Muayene kaydı");
  return record;
}
