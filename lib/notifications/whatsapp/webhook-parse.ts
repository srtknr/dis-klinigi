import { createHmac, timingSafeEqual } from "node:crypto";

/** Meta'nın X-Hub-Signature-256 başlığını uygulama sırrıyla doğrular (sabit zamanlı karşılaştırma). */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const provided = Buffer.from(header.slice("sha256=".length), "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export type InboundMessage = { from: string; payload: string };

/** Webhook gövdesinden hızlı yanıt butonu tıklamalarını ayıklar. Diğer mesaj türleri yok sayılır. */
export function extractButtonReplies(body: unknown): { phoneNumberId: string; messages: InboundMessage[] }[] {
  const out: { phoneNumberId: string; messages: InboundMessage[] }[] = [];
  const entries = (body as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value as
        | { metadata?: { phone_number_id?: string }; messages?: Record<string, unknown>[] }
        | undefined;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId || !Array.isArray(value?.messages)) continue;
      const messages: InboundMessage[] = [];
      for (const m of value.messages) {
        const from = typeof m.from === "string" ? m.from : null;
        // Şablon hızlı yanıt butonu: type "button"; etkileşimli yanıt: type "interactive"
        const button = m.button as { payload?: string } | undefined;
        const reply = (m.interactive as { button_reply?: { id?: string } } | undefined)?.button_reply;
        const payload = button?.payload ?? reply?.id;
        if (from && typeof payload === "string") messages.push({ from, payload });
      }
      if (messages.length > 0) out.push({ phoneNumberId, messages });
    }
  }
  return out;
}
