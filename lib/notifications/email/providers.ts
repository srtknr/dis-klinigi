import "server-only";
import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";
import { maskEmail } from "@/lib/phone";
import { ProviderError, type EmailMessage, type EmailProvider, type SendResult } from "@/lib/notifications/types";

/** Geliştirme sağlayıcısı: gerçek e-posta göndermez, yalnızca maskeli özet loglar. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly isMock = true;
  async send(message: EmailMessage): Promise<SendResult> {
    logger.info("email.mock_send", { to: maskEmail(message.to), subject: message.subject });
    if (process.env.NODE_ENV === "development") {
      console.info(`\n[MOCK E-POSTA] Alıcı: ${message.to}\nKonu: ${message.subject}\n${message.text}\n`);
    }
    return { providerMessageId: `mock-${Date.now()}` };
  }
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  readonly isMock = false;
  private transporter;
  constructor(
    private readonly from: string,
    config: { host: string; port: number; secure: boolean; user?: string; password?: string },
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
      connectionTimeout: 10_000,
    });
  }
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return { providerMessageId: info.messageId ?? null };
    } catch (error) {
      const code = (error as { responseCode?: number }).responseCode;
      // SMTP'de 4xx geçici, 5xx kalıcı hatadır; kod yoksa bağlantı hatasıdır
      throw new ProviderError(`SMTP gönderimi başarısız${code ? ` (kod ${code})` : ""}`, !code || (code >= 400 && code < 500));
    }
  }
}

/** Resend REST API adaptörü (https://resend.com/docs/api-reference/emails/send-email) */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  readonly isMock = false;
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}
  async send(message: EmailMessage): Promise<SendResult> {
    let res: Response;
    try {
      res = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ProviderError("Resend servisine ulaşılamadı", true);
    }
    if (!res.ok) {
      throw new ProviderError(`Resend gönderimi başarısız (HTTP ${res.status})`, res.status === 429 || res.status >= 500);
    }
    const data = (await res.json()) as { id?: string };
    return { providerMessageId: data.id ?? null };
  }
}
