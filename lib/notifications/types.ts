export type EmailMessage = { to: string; subject: string; text: string };
export type SmsMessage = { to: string; text: string };

export type SendResult = { providerMessageId: string | null };

export interface EmailProvider {
  readonly name: string;
  /** true ise gerçek gönderim yapılmaz (konsol/mock) */
  readonly isMock: boolean;
  send(message: EmailMessage): Promise<SendResult>;
}

export interface SmsProvider {
  readonly name: string;
  readonly isMock: boolean;
  /** `to`: E.164 biçiminde Türkiye numarası (+90…) */
  send(message: SmsMessage): Promise<SendResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable = true,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
