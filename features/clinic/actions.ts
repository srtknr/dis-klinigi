"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions";
import { requireActionAuth } from "@/lib/auth/current";
import { updateClinic, upsertService } from "@/features/clinic/service";
import {
  disconnectGoogle,
  retryCalendarSync,
  retryNotification,
} from "@/features/integrations/service";
import { assertCan } from "@/lib/permissions/guard";
import { processOutbox } from "@/lib/jobs/side-effects";

function refreshAll() {
  revalidatePath("/", "layout");
}

export async function updateClinicAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await updateClinic(ctx, input);
    refreshAll();
    return result;
  }, "Klinik bilgileri güncellendi.");
}

export async function upsertServiceAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await upsertService(ctx, input);
    refreshAll();
    return result;
  }, "Hizmet kaydedildi.");
}

export async function disconnectGoogleAction(connectionId: string) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await disconnectGoogle(ctx, String(connectionId));
    revalidatePath("/admin", "layout");
    return result;
  }, "Google Calendar bağlantısı kaldırıldı.");
}

export async function retryCalendarSyncAction(mappingId: string) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await retryCalendarSync(ctx, String(mappingId));
    revalidatePath("/admin", "layout");
    return result;
  });
}

export async function retryNotificationAction(notificationId: string) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await retryNotification(ctx, String(notificationId));
    revalidatePath("/admin", "layout");
    return result;
  });
}

/** Kuyruktaki bildirim ve takvim işlerini hemen işler (cron'a ek manuel tetikleme) */
export async function processOutboxNowAction() {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    assertCan(ctx, "SETTINGS_MANAGE");
    const result = await processOutbox(50);
    revalidatePath("/admin", "layout");
    return result;
  }, "Kuyruk işlendi.");
}
