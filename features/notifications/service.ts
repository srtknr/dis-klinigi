import "server-only";
import type { AuthContext } from "@/lib/auth/types";
import { db } from "@/lib/db";

export type StaffNotificationDto = {
  id: string;
  kind: string;
  title: string;
  body: string;
  appointmentId: string | null;
  read: boolean;
  createdAt: string;
};

/** Oturumdaki kullanıcının panel bildirimleri (yalnızca kendi kayıtları ve kendi kliniği). */
export async function listMyNotifications(ctx: AuthContext, limit = 15) {
  const where = { userId: ctx.userId, clinicId: ctx.clinicId };
  const [items, unread] = await Promise.all([
    db.staffNotification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
    db.staffNotification.count({ where: { ...where, readAt: null } }),
  ]);
  return {
    unread,
    items: items.map<StaffNotificationDto>((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      appointmentId: n.appointmentId,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function markNotificationsRead(ctx: AuthContext, ids?: string[]) {
  const result = await db.staffNotification.updateMany({
    where: { userId: ctx.userId, clinicId: ctx.clinicId, readAt: null, ...(ids ? { id: { in: ids.slice(0, 100) } } : {}) },
    data: { readAt: new Date() },
  });
  return { count: result.count };
}
