import { CLINIC_PLACEHOLDER } from "@/lib/forms/anamnesis";
import type { FormAnswers, FormAnswerValue, FormDefinition, FormField, FormStep } from "@/lib/forms/types";

export type FormErrors = Record<string, string>;

const REQUIRED_MESSAGE = "Bu alan zorunludur.";

/** Alan, bağlı olduğu koşula göre görünür mü? */
export function isFieldVisible(field: FormField, answers: FormAnswers): boolean {
  if (!field.showIf) return true;
  const value = answers[field.showIf.field];
  if (Array.isArray(value)) return value.includes(field.showIf.includes);
  return value === field.showIf.includes;
}

function isFutureDate(key: string): boolean {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  return key > today;
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/**
 * Tek bir alanı doğrular ve temizlenmiş değeri döndürür. Bilinmeyen/izin verilmeyen değerler hata sayılır.
 * Boş ve zorunlu değilse value: undefined döner (cevap kaydedilmez).
 */
function validateField(field: FormField, raw: unknown): { value?: FormAnswerValue; error?: string } {
  switch (field.type) {
    case "text":
    case "email":
    case "tel":
    case "textarea": {
      const text = typeof raw === "string" ? raw.trim() : "";
      if (!text) return field.required ? { error: REQUIRED_MESSAGE } : {};
      if (text.length > (field.maxLength ?? 500)) return { error: `En fazla ${field.maxLength ?? 500} karakter olabilir.` };
      if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { error: "Geçerli bir e-posta adresi girin." };
      if (field.type === "tel" && !/^[+\d][\d\s()-]{6,}$/.test(text)) return { error: "Geçerli bir telefon numarası girin." };
      return { value: text };
    }
    case "number": {
      const text = typeof raw === "string" ? raw.trim().replace(",", ".") : typeof raw === "number" ? String(raw) : "";
      if (!text) return field.required ? { error: REQUIRED_MESSAGE } : {};
      const n = Number(text);
      if (!Number.isFinite(n) || n < field.min || n > field.max) return { error: `${field.min} ile ${field.max} arasında bir değer girin.` };
      return { value: String(n) };
    }
    case "date": {
      const text = typeof raw === "string" ? raw.trim() : "";
      if (!text) return field.required ? { error: REQUIRED_MESSAGE } : {};
      if (!isValidDateKey(text)) return { error: "Geçerli bir tarih girin." };
      if (field.kind === "birth" && (isFutureDate(text) || text < "1900-01-01")) return { error: "Geçerli bir doğum tarihi girin." };
      return { value: text };
    }
    case "radio": {
      const text = typeof raw === "string" ? raw : "";
      if (!text) return field.required ? { error: "Lütfen bir seçenek belirleyin." } : {};
      if (!field.options.some((o) => o.value === text)) return { error: "Geçersiz seçim." };
      return { value: text };
    }
    case "checkbox": {
      const list = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
      const unique = [...new Set(list)];
      if (unique.length === 0) return field.required ? { error: "En az bir seçenek belirleyin." } : {};
      if (unique.some((v) => !field.options.some((o) => o.value === v))) return { error: "Geçersiz seçim." };
      const exclusive = field.options.find((o) => o.exclusive && unique.includes(o.value));
      if (exclusive && unique.length > 1) return { error: `"${exclusive.label}" diğer seçeneklerle birlikte seçilemez.` };
      // Seçenek sırasını koru (çıktı tutarlı olsun)
      return { value: field.options.map((o) => o.value).filter((v) => unique.includes(v)) };
    }
    case "consent": {
      if (raw === true) return { value: true };
      return field.required ? { error: "Devam etmek için onaylamanız gerekir." } : {};
    }
  }
}

export function validateStep(step: FormStep, answers: FormAnswers): { answers: FormAnswers; errors: FormErrors } {
  const clean: FormAnswers = {};
  const errors: FormErrors = {};
  for (const field of step.fields) {
    if (!isFieldVisible(field, answers)) continue;
    const result = validateField(field, answers[field.id]);
    if (result.error) errors[field.id] = result.error;
    else if (result.value !== undefined) clean[field.id] = result.value;
  }
  return { answers: clean, errors };
}

/**
 * Tüm formu doğrular. Yalnızca tanımlı ve görünür alanların cevapları döner; fazladan gelen alanlar atılır.
 * Koşullu alanların görünürlüğü, temizlenmiş cevaplar üzerinden hesaplanır.
 */
export function validateForm(def: FormDefinition, raw: unknown): { ok: true; answers: FormAnswers } | { ok: false; errors: FormErrors } {
  const input: FormAnswers = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as FormAnswers) : {};
  const answers: FormAnswers = {};
  const errors: FormErrors = {};
  for (const step of def.steps) {
    for (const field of step.fields) {
      if (!isFieldVisible(field, answers)) continue;
      const result = validateField(field, input[field.id]);
      if (result.error) errors[field.id] = result.error;
      else if (result.value !== undefined) answers[field.id] = result.value;
    }
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, answers };
}

export function withClinicName(label: string, clinicName: string): string {
  return label.replaceAll(CLINIC_PLACEHOLDER, clinicName);
}

export type AnswerRow = { id: string; label: string; value: string };
export type AnswerSection = { id: string; title: string; rows: AnswerRow[] };

function formatAnswer(field: FormField, value: FormAnswerValue | undefined): string {
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return "Yanıtlanmadı";
  switch (field.type) {
    case "radio":
      return field.options.find((o) => o.value === value)?.label ?? String(value);
    case "checkbox":
      return (Array.isArray(value) ? value : []).map((v) => field.options.find((o) => o.value === v)?.label ?? v).join(", ");
    case "consent":
      return value === true ? "Onaylandı" : "Onaylanmadı";
    case "date": {
      const [y, m, d] = String(value).split("-");
      return `${d}.${m}.${y}`;
    }
    default:
      return String(value);
  }
}

/** Kaydedilmiş cevapları okunabilir bölümlere çevirir (hekim sayfası ve PDF ortak kullanır). */
export function describeAnswers(def: FormDefinition, answers: FormAnswers, clinicName: string): AnswerSection[] {
  return def.steps.map((step) => ({
    id: step.id,
    title: step.title,
    rows: step.fields
      .filter((f) => isFieldVisible(f, answers))
      .map((f) => ({ id: f.id, label: withClinicName(f.label, clinicName), value: formatAnswer(f, answers[f.id]) })),
  }));
}
