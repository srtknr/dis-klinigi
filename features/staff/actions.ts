"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions";
import { requireActionAuth } from "@/lib/auth/current";
import { createStaff, removeStaffAccess, resetStaffPassword, updateStaff } from "@/features/staff/service";

export async function createStaffAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await createStaff(ctx, input);
    revalidatePath("/admin", "layout");
    return result;
  }, "Çalışan hesabı oluşturuldu.");
}

export async function updateStaffAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await updateStaff(ctx, input);
    revalidatePath("/admin", "layout");
    return result;
  }, "Çalışan bilgileri güncellendi.");
}

export async function resetStaffPasswordAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await resetStaffPassword(ctx, input);
    return result;
  }, "Şifre güncellendi; çalışanın açık oturumları kapatıldı.");
}

export async function removeStaffAccessAction(membershipId: string) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await removeStaffAccess(ctx, String(membershipId));
    revalidatePath("/admin", "layout");
    return result;
  }, "Çalışanın klinik erişimi kaldırıldı.");
}
