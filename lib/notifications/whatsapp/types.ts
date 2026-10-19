import type { SendResult } from "@/lib/notifications/types";

export type WhatsappTemplateMessage = {
  /** E.164 biçiminde Türkiye numarası (+90…) */
  to: string;
  templateName: string;
  language: string;
  /** Şablon gövdesindeki {{1}}, {{2}}… değişkenleri (sırayla) */
  bodyParams: string[];
  /** Hızlı yanıt butonlarının payload'ları (sırayla: 0. ve 1. buton) */
  buttonPayloads: string[];
};

export interface WhatsappProvider {
  readonly name: string;
  readonly isMock: boolean;
  sendTemplate(message: WhatsappTemplateMessage): Promise<SendResult>;
}

/** Hatırlatma şablonunun gövde değişkenleri. Meta'da onaylatılan şablonla aynı sırada olmalıdır. */
export const REMINDER_TEMPLATE_PARAMS = ["Hasta adı", "Klinik adı", "Tarih", "Saat", "Hekim"] as const;

export const REMINDER_TEMPLATE_EXAMPLE =
  "Merhaba {{1}}, {{2}} bünyesinde {{3}} saat {{4}} için {{5}} ile randevunuz bulunmaktadır. Randevunuza gelmeyi düşünüyor musunuz?";
export const REMINDER_BUTTONS = ["Evet, geleceğim", "Hayır, gelemeyeceğim"] as const;

const PAYLOAD_PREFIX = "att";

export type AttendancePayload = { response: "YES" | "NO"; appointmentId: string };

export function buildAttendancePayload(response: "YES" | "NO", appointmentId: string): string {
  return `${PAYLOAD_PREFIX}:${response === "YES" ? "yes" : "no"}:${appointmentId}`;
}

export function parseAttendancePayload(payload: unknown): AttendancePayload | null {
  if (typeof payload !== "string" || payload.length > 256) return null;
  const [prefix, answer, appointmentId, ...rest] = payload.split(":");
  if (prefix !== PAYLOAD_PREFIX || rest.length > 0 || !appointmentId) return null;
  if (answer !== "yes" && answer !== "no") return null;
  return { response: answer === "yes" ? "YES" : "NO", appointmentId };
}
