"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions";
import { requireActionAuth } from "@/lib/auth/current";
import { addPatientNote, createPatient, updatePatient } from "@/features/patients/service";

export async function createPatientAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await createPatient(ctx, input);
    revalidatePath("/admin", "layout");
    return result;
  }, "Hasta kaydı oluşturuldu.");
}

export async function updatePatientAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await updatePatient(ctx, input);
    revalidatePath("/admin", "layout");
    return result;
  }, "Hasta bilgileri güncellendi.");
}

export async function addPatientNoteAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await addPatientNote(ctx, input);
    revalidatePath("/admin", "layout");
    return result;
  }, "Not eklendi.");
}
