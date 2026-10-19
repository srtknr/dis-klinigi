import "server-only";
import { logger } from "@/lib/logger";
import { maskPhone, toSmsMsisdn } from "@/lib/phone";
import { ProviderError, type SendResult } from "@/lib/notifications/types";
import type { WhatsappProvider, WhatsappTemplateMessage } from "@/lib/notifications/whatsapp/types";

/** Geliştirme sağlayıcısı: gerçek WhatsApp mesajı göndermez. */
export class ConsoleWhatsappProvider implements WhatsappProvider {
  readonly name = "console";
  readonly isMock = true;
  async sendTemplate(message: WhatsappTemplateMessage): Promise<SendResult> {
    logger.info("whatsapp.mock_send", { to: maskPhone(message.to), template: message.templateName });
    if (process.env.NODE_ENV === "development") {
      console.info(
        `\n[MOCK WHATSAPP] ${toSmsMsisdn(message.to)} · şablon: ${message.templateName}/${message.language}\n` +
          `Değişkenler: ${message.bodyParams.join(" | ")}\nButonlar: ${message.buttonPayloads.join(" | ")}\n`,
      );
    }
    return { providerMessageId: `mock-${Date.now()}` };
  }
}

/** Meta WhatsApp Business Cloud API adaptörü. Her klinik kendi telefon numarası kimliği ve token'ı ile çalışır. */
export class MetaCloudWhatsappProvider implements WhatsappProvider {
  readonly name = "meta";
  readonly isMock = false;
  constructor(
    private readonly config: { phoneNumberId: string; accessToken: string; apiVersion?: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendTemplate(message: WhatsappTemplateMessage): Promise<SendResult> {
    const version = this.config.apiVersion ?? "v21.0";
    const components: unknown[] = [];
    if (message.bodyParams.length > 0) {
      components.push({ type: "body", parameters: message.bodyParams.map((text) => ({ type: "text", text })) });
    }
    message.buttonPayloads.forEach((payload, index) => {
      components.push({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload }] });
    });

    let res: Response;
    try {
      res = await this.fetchImpl(`https://graph.facebook.com/${version}/${encodeURIComponent(this.config.phoneNumberId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.accessToken}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toSmsMsisdn(message.to),
          type: "template",
          template: { name: message.templateName, language: { code: message.language }, components },
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ProviderError("WhatsApp servisine ulaşılamadı", true);
    }
    const body = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { code?: number; message?: string };
    };
    if (!res.ok) {
      const code = body.error?.code;
      // 190: token geçersiz, 132000-132999: şablon sorunları, 131xxx: alıcı/politika sorunları → tekrar denemek işe yaramaz
      throw new ProviderError(
        `WhatsApp gönderimi başarısız (HTTP ${res.status}${code ? `, kod ${code}` : ""}${body.error?.message ? `: ${body.error.message}` : ""})`,
        res.status >= 500 || res.status === 429,
      );
    }
    return { providerMessageId: body.messages?.[0]?.id ?? null };
  }
}
