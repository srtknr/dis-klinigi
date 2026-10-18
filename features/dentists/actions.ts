"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions";
import { requireActionAuth } from "@/lib/auth/current";
import {
  addBlockedTime,
  createDentist,
  removeBlockedTime,
  saveDentistPhoto,
  setWorkingHours,
  updateDentist,
} from "@/features/dentists/service";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

export async function createDentistAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await createDentist(ctx, input);
    refresh();
    return result;
  }, "Doktor eklendi. Çalışma programını kontrol etmeyi unutmayın.");
}

export async function updateDentistAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await updateDentist(ctx, input);
    refresh();
    return result;
  }, "Doktor bilgileri güncellendi.");
}

export async function setWorkingHoursAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await setWorkingHours(ctx, input);
    refresh();
    return result;
  }, "Çalışma programı kaydedildi.");
}

export async function addBlockedTimeAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await addBlockedTime(ctx, input);
    refresh();
    return result;
  }, "İzin / kapalı zaman eklendi.");
}

export async function removeBlockedTimeAction(blockedTimeId: string) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await removeBlockedTime(ctx, String(blockedTimeId));
    refresh();
    return result;
  }, "Kayıt kaldırıldı.");
}

export async function uploadDentistPhotoAction(formData: FormData) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const file = formData.get("photo");
    const result = await saveDentistPhoto(ctx, String(formData.get("dentistId") ?? ""), file instanceof File ? file : null);
    refresh();
    return result;
  }, "Fotoğraf güncellendi.");
}
