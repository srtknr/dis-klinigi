"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions";
import { requireActionAuth } from "@/lib/auth/current";
import { createTreatmentRecord, updateTreatmentRecord, voidTreatmentRecord } from "@/features/treatments/service";

export async function createTreatmentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await createTreatmentRecord(ctx, input);
    revalidatePath("/admin", "layout");
    return result;
  }, "Muayene kaydı oluşturuldu.");
}

export async function updateTreatmentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await updateTreatmentRecord(ctx, input);
    revalidatePath("/admin", "layout");
    return result;
  }, "Muayene kaydı düzeltildi; önceki sürüm saklandı.");
}

export async function voidTreatmentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await voidTreatmentRecord(ctx, input);
    revalidatePath("/admin", "layout");
    return result;
  }, "Kayıt geçersiz olarak işaretlendi.");
}
