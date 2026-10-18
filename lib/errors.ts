export type AppErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PATIENT_MATCH_REQUIRED"
  | "DUPLICATE_PATIENT"
  | "INVALID_STATE";

/**
 * Kullanıcıya gösterilmesi güvenli hata. Mesajlar Türkçe ve teknik ayrıntı içermez.
 */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errors = {
  unauthenticated: () => new AppError("UNAUTHENTICATED", "Oturumunuz sona erdi. Lütfen tekrar giriş yapın."),
  forbidden: () => new AppError("FORBIDDEN", "Bu işlem için yetkiniz bulunmuyor."),
  notFound: (what = "Kayıt") => new AppError("NOT_FOUND", `${what} bulunamadı.`),
  conflict: (message: string) => new AppError("CONFLICT", message),
  invalidState: (message: string) => new AppError("INVALID_STATE", message),
  validation: (message: string, fieldErrors?: Record<string, string[]>) =>
    new AppError("VALIDATION", message, fieldErrors),
  rateLimited: () =>
    new AppError("RATE_LIMITED", "Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin."),
};

export const SLOT_TAKEN_MESSAGE =
  "Seçtiğiniz saat az önce doldu veya artık uygun değil. Lütfen başka bir saat seçin.";
