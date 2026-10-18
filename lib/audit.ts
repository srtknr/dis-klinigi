import "server-only";
import type { DbOrTx } from "@/lib/db";
import { Prisma } from "@/lib/db";
import type { AuthContext } from "@/lib/auth/types";

/**
 * Denetim kaydı yazar. metadata yalnızca teknik/idari bilgi içermelidir
 * (değişen alan adları, durumlar, kimlikler). Klinik not içeriği yazılmaz.
 */
export async function writeAudit(
  client: DbOrTx,
  input: {
    ctx?: Pick<AuthContext, "userId" | "clinicId"> | null;
    clinicId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    ipHash?: string | null;
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      clinicId: input.ctx?.clinicId ?? input.clinicId ?? null,
      actorUserId: input.ctx?.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      ipHash: input.ipHash ?? null,
    },
  });
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Giriş yapıldı",
  "auth.login_failed": "Başarısız giriş denemesi",
  "auth.logout": "Çıkış yapıldı",
  "appointment.requested": "Online randevu talebi oluşturuldu",
  "appointment.created": "Randevu oluşturuldu",
  "appointment.confirmed": "Randevu onaylandı",
  "appointment.rejected": "Randevu reddedildi",
  "appointment.cancelled": "Randevu iptal edildi",
  "appointment.rescheduled": "Randevu yeniden planlandı",
  "appointment.completed": "Randevu tamamlandı",
  "appointment.no_show": "Randevuya gelinmedi",
  "appointment.patient_linked": "Randevu hasta ile eşleştirildi",
  "appointment.note_added": "Randevuya not eklendi",
  "patient.created": "Hasta kaydı oluşturuldu",
  "patient.updated": "Hasta bilgileri güncellendi",
  "patient.note_added": "Hastaya not eklendi",
  "patient.viewed_clinical": "Muayene geçmişi görüntülendi",
  "treatment.created": "Muayene kaydı oluşturuldu",
  "treatment.updated": "Muayene kaydı düzeltildi",
  "treatment.voided": "Muayene kaydı geçersiz kılındı",
  "dentist.created": "Doktor eklendi",
  "dentist.updated": "Doktor bilgileri güncellendi",
  "dentist.schedule_updated": "Çalışma programı güncellendi",
  "dentist.blocked_time_added": "İzin / kapalı zaman eklendi",
  "dentist.blocked_time_removed": "İzin / kapalı zaman kaldırıldı",
  "staff.created": "Çalışan eklendi",
  "staff.updated": "Çalışan güncellendi",
  "staff.access_removed": "Çalışan erişimi kaldırıldı",
  "staff.password_reset": "Çalışan şifresi sıfırlandı",
  "clinic.updated": "Klinik bilgileri güncellendi",
  "service.created": "Hizmet eklendi",
  "service.updated": "Hizmet güncellendi",
  "calendar.connected": "Google Calendar bağlandı",
  "calendar.disconnected": "Google Calendar bağlantısı kaldırıldı",
  "notification.retried": "Bildirim yeniden denendi",
};
