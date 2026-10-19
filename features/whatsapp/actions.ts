"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions";
import { requireActionAuth } from "@/lib/auth/current";
import { saveWhatsappConfig } from "@/features/whatsapp/service";

export async function saveWhatsappConfigAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await saveWhatsappConfig(ctx, input);
    revalidatePath("/admin/entegrasyonlar");
    return result;
  }, "WhatsApp ayarları kaydedildi.");
}
