import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ActionResult } from "@/types/action";

export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Server action gövdesini çalıştırır ve sonucu serileştirilebilir bir ActionResult'a çevirir.
 * Beklenmeyen hatalar ayrıntı sızdırmadan genel bir mesajla döner.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
  successMessage?: string,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message: successMessage };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) {
      return {
        ok: false,
        error: error.message,
        code: error.code,
        fieldErrors: error.fieldErrors,
        details: error.details,
      };
    }
    if (error instanceof ZodError) {
      return {
        ok: false,
        error: "Lütfen formdaki hatalı alanları düzeltin.",
        code: "VALIDATION",
        fieldErrors: zodFieldErrors(error),
      };
    }
    logger.error("action.unexpected_error", error);
    return { ok: false, error: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin." };
  }
}
