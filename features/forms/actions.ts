"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { runAction } from "@/lib/actions";
import { requireActionAuth } from "@/lib/auth/current";
import { errors } from "@/lib/errors";
import { dispatchPendingNotifications } from "@/lib/notifications/outbox";
import { clientIpHash, getClientIp, rateLimit } from "@/lib/rate-limit";
import { cancelFormRequest, createFormRequest, submitPublicForm } from "@/features/forms/service";

export async function createFormRequestAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await createFormRequest(ctx, input);
    if (result.sms || result.email) after(() => dispatchPendingNotifications({ limit: 10 }));
    revalidatePath("/admin/hastalar", "layout");
    return result;
  });
}

export async function cancelFormRequestAction(requestId: string) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await cancelFormRequest(ctx, String(requestId));
    revalidatePath("/admin/hastalar", "layout");
    return result;
  }, "Form bağlantısı iptal edildi.");
}

/** Hastanın formu göndermesi (oturumsuz). IP başına hız sınırlı; bağlantı tek kullanımlıktır. */
export async function submitPatientFormAction(token: string, answers: unknown) {
  return runAction(async () => {
    const h = await headers();
    const limit = await rateLimit("patient-form-submit", getClientIp(h), 20, 60 * 60);
    if (!limit.ok) throw errors.rateLimited();
    const result = await submitPublicForm(String(token), answers, { ipHash: clientIpHash(h) });
    revalidatePath("/admin", "layout");
    return result;
  });
}
