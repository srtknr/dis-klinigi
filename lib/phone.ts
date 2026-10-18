/**
 * Türkiye telefon numaraları için normalizasyon.
 * Kabul edilen girişler: "0545 501 56 11", "5455015611", "+90 545 501 56 11", "90545...", "0090545..."
 * Saklama biçimi: E.164 → "+905455015611"
 */
export function normalizeTrPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith("90")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length !== 10) return null;
  // Sabit hatlar 2/3/4, mobil hatlar 5 ile başlar
  if (!/^[2-5]/.test(digits)) return null;
  return `+90${digits}`;
}

export function isTrMobile(e164: string): boolean {
  return /^\+905\d{9}$/.test(e164);
}

/** SMS sağlayıcılarının beklediği uluslararası biçim (artı işareti olmadan): "905455015611" */
export function toSmsMsisdn(e164: string): string {
  const normalized = normalizeTrPhone(e164);
  if (!normalized) throw new Error("Geçersiz telefon numarası");
  return normalized.slice(1);
}

/** "+905455015611" → "0545 501 56 11" */
export function formatPhone(e164: string | null | undefined): string {
  const normalized = normalizeTrPhone(e164 ?? "");
  if (!normalized) return e164 ?? "";
  const d = normalized.slice(3);
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}

/** Log ve listelerde kullanım için maskeleme: "0545 *** ** 11" */
export function maskPhone(e164: string): string {
  const normalized = normalizeTrPhone(e164);
  if (!normalized) return "***";
  const d = normalized.slice(3);
  return `0${d.slice(0, 3)} *** ** ${d.slice(8, 10)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
