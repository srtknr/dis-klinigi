import "server-only";
import { normalizeTrPhone } from "@/lib/phone";
import { ConsoleEmailProvider, ResendEmailProvider, SmtpEmailProvider } from "@/lib/notifications/email/providers";
import { ConsoleSmsProvider, NetgsmSmsProvider } from "@/lib/notifications/sms/providers";
import type { EmailProvider, SmsProvider } from "@/lib/notifications/types";
import { ConsoleWhatsappProvider, MetaCloudWhatsappProvider } from "@/lib/notifications/whatsapp/providers";
import type { WhatsappProvider } from "@/lib/notifications/whatsapp/types";

const isProduction = () => process.env.NODE_ENV === "production";

export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  const from = process.env.EMAIL_FROM ?? "Diş Kliniği <no-reply@example.com>";
  if (provider === "smtp" && process.env.SMTP_HOST) {
    return new SmtpEmailProvider(from, {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || undefined,
      password: process.env.SMTP_PASSWORD || undefined,
    });
  }
  if (provider === "resend" && process.env.RESEND_API_KEY) {
    return new ResendEmailProvider(process.env.RESEND_API_KEY, from);
  }
  return new ConsoleEmailProvider();
}

/**
 * Gerçek SMS yalnızca SMS_LIVE_SEND="true" ve sağlayıcı bilgileri eksiksizse gönderilir.
 * Aksi halde mock sağlayıcı kullanılır.
 */
export function getSmsProvider(): SmsProvider {
  const live = process.env.SMS_LIVE_SEND === "true";
  if (live && process.env.SMS_PROVIDER === "netgsm") {
    const { NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_MSGHEADER } = process.env;
    if (NETGSM_USERCODE && NETGSM_PASSWORD && NETGSM_MSGHEADER) {
      return new NetgsmSmsProvider({ usercode: NETGSM_USERCODE, password: NETGSM_PASSWORD, msgheader: NETGSM_MSGHEADER });
    }
  }
  return new ConsoleSmsProvider();
}

/** Production dışında tüm SMS'ler test numarasına yönlendirilir. */
export function resolveSmsRecipient(original: string): string {
  if (!isProduction()) {
    const test = normalizeTrPhone(process.env.SMS_TEST_RECIPIENT);
    if (test) return test;
  }
  return original;
}

/** Production dışında EMAIL_TEST_RECIPIENT tanımlıysa hasta e-postaları oraya yönlendirilir. */
export function resolveEmailRecipient(original: string): string {
  if (!isProduction() && process.env.EMAIL_TEST_RECIPIENT) return process.env.EMAIL_TEST_RECIPIENT;
  return original;
}

export function adminNotificationFallback(): string | null {
  return process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || null;
}

export type IntegrationStatus = {
  email: { provider: string; live: boolean; note: string };
  sms: { provider: string; live: boolean; note: string; testRecipient: string | null };
};

export function describeNotificationSetup(): IntegrationStatus {
  const email = getEmailProvider();
  const sms = getSmsProvider();
  const smsRedirect = !isProduction() ? normalizeTrPhone(process.env.SMS_TEST_RECIPIENT) : null;
  return {
    email: {
      provider: email.name,
      live: !email.isMock,
      note: email.isMock
        ? "Mock mod: e-postalar gönderilmez, sunucu konsoluna yazılır. Gerçek gönderim için EMAIL_PROVIDER=smtp veya resend ve ilgili anahtarları tanımlayın."
        : `E-postalar ${email.name.toUpperCase()} üzerinden gönderilir.`,
    },
    sms: {
      provider: sms.name,
      live: !sms.isMock,
      testRecipient: smsRedirect,
      note: sms.isMock
        ? "Mock mod: SMS gönderilmez. Gerçek gönderim için SMS_PROVIDER=netgsm, SMS_LIVE_SEND=true ve NetGSM bilgilerini tanımlayın."
        : "SMS'ler NetGSM üzerinden gönderilir.",
    },
  };
}

/**
 * Gerçek WhatsApp mesajı yalnızca WHATSAPP_LIVE_SEND="true" iken gönderilir; aksi halde mock kullanılır.
 * Token ve telefon numarası kimliği kliniğe aittir (ClinicWhatsappConfig).
 */
export function getWhatsappProvider(config: { phoneNumberId: string; accessToken: string }): WhatsappProvider {
  if (process.env.WHATSAPP_LIVE_SEND === "true") {
    return new MetaCloudWhatsappProvider({ ...config, apiVersion: process.env.WHATSAPP_API_VERSION || undefined });
  }
  return new ConsoleWhatsappProvider();
}

/** Production dışında tüm WhatsApp mesajları test numarasına yönlendirilir. */
export function resolveWhatsappRecipient(original: string): string {
  if (!isProduction()) {
    const test = normalizeTrPhone(process.env.WHATSAPP_TEST_RECIPIENT);
    if (test) return test;
  }
  return original;
}

export function describeWhatsappSetup() {
  const live = process.env.WHATSAPP_LIVE_SEND === "true";
  return {
    live,
    webhookReady: Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN),
    testRecipient: !isProduction() ? normalizeTrPhone(process.env.WHATSAPP_TEST_RECIPIENT) : null,
  };
}
