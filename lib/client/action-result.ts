"use client";

import { toast } from "sonner";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/types/action";

/**
 * Server action sonucunu kullanıcıya bildirir; alan hatalarını React Hook Form'a aktarır.
 * Başarılıysa true döner.
 */
export function handleActionResult<T, F extends FieldValues = FieldValues>(
  result: ActionResult<T>,
  options: { setError?: UseFormSetError<F>; successMessage?: string; silentSuccess?: boolean } = {},
): result is { ok: true; data: T; message?: string } {
  if (result.ok) {
    if (!options.silentSuccess) toast.success(options.successMessage ?? result.message ?? "İşlem tamamlandı.");
    return true;
  }
  if (result.fieldErrors && options.setError) {
    for (const [field, messages] of Object.entries(result.fieldErrors)) {
      if (field === "_form") continue;
      options.setError(field as Path<F>, { type: "server", message: messages[0] });
    }
  }
  toast.error(result.error);
  return false;
}
