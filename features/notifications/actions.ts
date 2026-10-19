"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions";
import { requireActionAuth } from "@/lib/auth/current";
import { markNotificationsRead } from "@/features/notifications/service";

export async function markNotificationsReadAction(ids?: string[]) {
  return runAction(async () => {
    const ctx = await requireActionAuth();
    const result = await markNotificationsRead(ctx, Array.isArray(ids) ? ids.map(String) : undefined);
    revalidatePath("/admin", "layout");
    return result;
  });
}
