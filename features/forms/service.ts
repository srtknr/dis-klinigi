import "server-only";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/types";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { db } from "@/lib/db";
import { errors } from "@/lib/errors";
import { ANAMNESIS_FORM, ANAMNESIS_FORM_KEY, FORM_LINK_VALID_DAYS } from "@/lib/forms/anamnesis";
import type { FormAnswers } from "@/lib/forms/types";
import { describeAnswers, validateForm } from "@/lib/forms/validate";
import { renderFormLinkEmail, renderFormLinkSms } from "@/lib/notifications/templates";
import { assertCan } from "@/lib/permissions/guard";
import { isTrMobile, normalizeTrPhone } from "@/lib/phone";
import { idField } from "@/lib/validations/common";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const DAY_MS = 24 * 60 * 60_000;

const createSchema = z.object({
  patientId: idField,
  sendSms: z.boolean(),
  sendEmail: z.boolean(),
});

export type FormDisplayStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED";

function displayStatus(r: { status: "PENDING" | "COMPLETED" | "CANCELLED"; expiresAt: Date }, now = new Date()): FormDisplayStatus {
  return r.status === "PENDING" && r.expiresAt <= now ? "EXPIRED" : r.status;
}

/**
 * Hastaya sağlık formu bağlantısı üretir. Hasta için önceki bekleyen bağlantılar iptal edilir (tek aktif bağlantı).
 * Ham token yalnızca burada döner; veritabanında özeti saklanır. SMS/e-posta isteniyorsa outbox'a yazılır.
 */
export async function createFormRequest(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "TREATMENT_MANAGE");
  const input = createSchema.parse(raw);
  const patient = await db.patient.findFirst({
    where: { id: input.patientId, clinicId: ctx.clinicId },
    select: { id: true, firstName: true, phone: true, email: true, clinic: { select: { name: true } } },
  });
  if (!patient) throw errors.notFound("Hasta");

  const phone = normalizeTrPhone(patient.phone);
  if (input.sendSms && !(phone && isTrMobile(phone))) throw errors.validation("Hastanın kayıtlı bir cep telefonu yok; SMS gönderilemez.");
  if (input.sendEmail && !patient.email) throw errors.validation("Hastanın kayıtlı bir e-posta adresi yok.");

  const token = randomToken(32);
  const link = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/anamnez/${token}`;
  const now = new Date();

  const request = await db.$transaction(async (tx) => {
    await tx.patientFormRequest.updateMany({
      where: { patientId: patient.id, formKey: ANAMNESIS_FORM_KEY, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    const created = await tx.patientFormRequest.create({
      data: {
        clinicId: ctx.clinicId,
        patientId: patient.id,
        formKey: ANAMNESIS_FORM_KEY,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(now.getTime() + FORM_LINK_VALID_DAYS * DAY_MS),
        createdById: ctx.userId,
      },
    });
    const data = { firstName: patient.firstName, clinicName: patient.clinic.name, link, validDays: FORM_LINK_VALID_DAYS };
    const rows: { channel: "SMS" | "EMAIL"; recipient: string; subject: string | null; body: string }[] = [];
    if (input.sendSms && phone) rows.push({ channel: "SMS", recipient: phone, subject: null, body: renderFormLinkSms(data) });
    if (input.sendEmail && patient.email) {
      const mail = renderFormLinkEmail(data);
      rows.push({ channel: "EMAIL", recipient: patient.email, subject: mail.subject, body: mail.text });
    }
    if (rows.length > 0) {
      await tx.notificationLog.createMany({
        data: rows.map((row) => ({
          clinicId: ctx.clinicId,
          template: "PATIENT_FORM_LINK" as const,
          idempotencyKey: `PATIENT_FORM_LINK:${created.id}:${row.channel}`,
          ...row,
        })),
        skipDuplicates: true,
      });
    }
    await writeAudit(tx, {
      ctx,
      action: "patient_form.sent",
      entityType: "PatientFormRequest",
      entityId: created.id,
      metadata: { patientId: patient.id, sms: input.sendSms, email: input.sendEmail },
    });
    return created;
  });

  return { requestId: request.id, link, expiresAt: request.expiresAt.toISOString(), sms: input.sendSms, email: input.sendEmail };
}

export async function cancelFormRequest(ctx: AuthContext, requestId: string) {
  assertCan(ctx, "TREATMENT_MANAGE");
  const result = await db.patientFormRequest.updateMany({
    where: { id: requestId, clinicId: ctx.clinicId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (result.count !== 1) throw errors.invalidState("Yalnızca bekleyen form bağlantıları iptal edilebilir.");
  await writeAudit(db, { ctx, action: "patient_form.cancelled", entityType: "PatientFormRequest", entityId: requestId });
  return { ok: true };
}

/** Hasta kartındaki liste. Cevap içeriği döndürülmez. */
export async function listPatientForms(ctx: AuthContext, patientId: string) {
  assertCan(ctx, "TREATMENT_VIEW");
  const rows = await db.patientFormRequest.findMany({
    where: { patientId, clinicId: ctx.clinicId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      completedAt: true,
      createdBy: { select: { name: true } },
    },
  });
  const now = new Date();
  return rows.map((r) => ({ ...r, displayStatus: displayStatus(r, now) }));
}

/** Hekim için tamamlanmış form sonucu. Sağlık verisi okunduğu için denetim kaydı yazılır. */
export async function getFormResult(ctx: AuthContext, patientId: string, requestId: string) {
  assertCan(ctx, "TREATMENT_VIEW");
  const request = await db.patientFormRequest.findFirst({
    where: { id: requestId, patientId, clinicId: ctx.clinicId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      clinic: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!request) throw errors.notFound("Form");
  const answers = (request.answers ?? {}) as FormAnswers;
  const completed = request.status === "COMPLETED";
  if (completed) {
    await writeAudit(db, { ctx, action: "patient_form.viewed", entityType: "PatientFormRequest", entityId: request.id });
  }
  return {
    request: {
      id: request.id,
      status: displayStatus(request),
      createdAt: request.createdAt,
      completedAt: request.completedAt,
      signatureName: request.signatureName,
      createdByName: request.createdBy?.name ?? null,
    },
    patient: request.patient,
    clinicName: request.clinic.name,
    title: ANAMNESIS_FORM.title,
    sections: completed ? describeAnswers(ANAMNESIS_FORM, answers, request.clinic.name) : [],
  };
}

// ───────────────────────── Hastaya açık (oturumsuz) işlemler ─────────────────────────

export type PublicFormState =
  | { state: "invalid" | "expired" | "cancelled" | "completed"; clinicName?: string }
  | { state: "open"; clinicName: string; prefill: FormAnswers };

async function findByToken(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  return db.patientFormRequest.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: {
      clinic: { select: { name: true } },
      patient: { select: { firstName: true, lastName: true, phone: true, email: true, birthDate: true } },
    },
  });
}

export async function getPublicForm(token: string): Promise<PublicFormState> {
  const request = await findByToken(token);
  if (!request) return { state: "invalid" };
  const clinicName = request.clinic.name;
  if (request.status === "COMPLETED") return { state: "completed", clinicName };
  if (request.status === "CANCELLED") return { state: "cancelled", clinicName };
  if (request.expiresAt <= new Date()) return { state: "expired", clinicName };

  const p = request.patient;
  const prefill: FormAnswers = { adSoyad: `${p.firstName} ${p.lastName}`.trim(), telefon: p.phone };
  if (p.email) prefill.eposta = p.email;
  if (p.birthDate) prefill.dogumTarihi = p.birthDate.toISOString().slice(0, 10);
  return { state: "open", clinicName, prefill };
}

/**
 * Hastanın doldurduğu formu kaydeder. Cevaplar sunucuda yeniden doğrulanır; bağlantı tek kullanımlıktır
 * (koşullu güncelleme sayesinde aynı anda gelen çift gönderimde yalnızca biri kabul edilir).
 */
export async function submitPublicForm(token: string, rawAnswers: unknown, meta: { ipHash: string | null }) {
  const request = await findByToken(token);
  if (!request || request.status !== "PENDING" || request.expiresAt <= new Date()) {
    throw errors.invalidState("Bu bağlantı geçersiz, süresi dolmuş veya form daha önce gönderilmiş.");
  }
  const checked = validateForm(ANAMNESIS_FORM, rawAnswers);
  if (!checked.ok) {
    const fieldErrors = Object.fromEntries(Object.entries(checked.errors).map(([k, v]) => [k, [v]]));
    throw errors.validation("Lütfen formdaki hatalı alanları düzeltin.", fieldErrors);
  }
  const now = new Date();
  const answers = checked.answers;

  await db.$transaction(async (tx) => {
    const updated = await tx.patientFormRequest.updateMany({
      where: { id: request.id, status: "PENDING", expiresAt: { gt: now } },
      data: {
        status: "COMPLETED",
        completedAt: now,
        consentAt: now,
        answers,
        signatureName: typeof answers.imza === "string" ? answers.imza : null,
        ipHash: meta.ipHash,
      },
    });
    if (updated.count !== 1) throw errors.invalidState("Bu form daha önce gönderilmiş veya süresi dolmuş.");

    // Bağlantıyı gönderen kullanıcıya (hekim/asistan) panel bildirimi
    if (request.createdById) {
      const member = await tx.membership.findFirst({
        where: { userId: request.createdById, clinicId: request.clinicId, isActive: true, user: { isActive: true } },
        select: { userId: true },
      });
      if (member) {
        await tx.staffNotification.create({
          data: {
            clinicId: request.clinicId,
            userId: member.userId,
            kind: "FORM_COMPLETED",
            title: `${request.patient.firstName} ${request.patient.lastName} sağlık formunu doldurdu`,
            body: ANAMNESIS_FORM.title,
            link: `/admin/hastalar/${request.patientId}/formlar/${request.id}`,
          },
        });
      }
    }
    await writeAudit(tx, {
      clinicId: request.clinicId,
      action: "patient_form.completed",
      entityType: "PatientFormRequest",
      entityId: request.id,
      metadata: { formKey: request.formKey },
      ipHash: meta.ipHash,
    });
  });
  return { ok: true };
}
