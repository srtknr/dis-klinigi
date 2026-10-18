import "server-only";
import { logger } from "@/lib/logger";
import { maskPhone, toSmsMsisdn } from "@/lib/phone";
import { ProviderError, type SendResult, type SmsMessage, type SmsProvider } from "@/lib/notifications/types";

/** Geliştirme sağlayıcısı: gerçek SMS göndermez. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  readonly isMock = true;
  async send(message: SmsMessage): Promise<SendResult> {
    const msisdn = toSmsMsisdn(message.to);
    logger.info("sms.mock_send", { to: maskPhone(message.to), length: message.text.length });
    if (process.env.NODE_ENV === "development") {
      console.info(`\n[MOCK SMS] Alıcı (sağlayıcı biçimi): ${msisdn}\n${message.text}\n`);
    }
    return { providerMessageId: `mock-${Date.now()}` };
  }
}

/**
 * NetGSM REST v2 adaptörü.
 * Gerçek gönderim için NetGSM hesabı, API kullanıcısı ve BTK onaylı gönderici başlığı (msgheader) gerekir.
 * Uç nokta ve yanıt biçimi NetGSM'in güncel dokümantasyonuyla üretime geçmeden önce doğrulanmalıdır.
 */
export class NetgsmSmsProvider implements SmsProvider {
  readonly name = "netgsm";
  readonly isMock = false;
  constructor(
    private readonly config: { usercode: string; password: string; msgheader: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: SmsMessage): Promise<SendResult> {
    const msisdn = toSmsMsisdn(message.to);
    let res: Response;
    try {
      res = await this.fetchImpl("https://api.netgsm.com.tr/sms/rest/v2/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${this.config.usercode}:${this.config.password}`).toString("base64")}`,
        },
        body: JSON.stringify({
          msgheader: this.config.msgheader,
          encoding: "TR",
          iysfilter: "0",
          messages: [{ msg: message.text, no: msisdn }],
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ProviderError("NetGSM servisine ulaşılamadı", true);
    }
    const body = (await res.json().catch(() => ({}))) as { code?: string; jobid?: string; description?: string };
    if (!res.ok || (body.code && body.code !== "00")) {
      throw new ProviderError(
        `NetGSM gönderimi başarısız (HTTP ${res.status}${body.code ? `, kod ${body.code}` : ""})`,
        res.status >= 500 || res.status === 429,
      );
    }
    return { providerMessageId: body.jobid ?? null };
  }
}
