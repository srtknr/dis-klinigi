import type { NotificationTemplate } from "@/generated/prisma/enums";

/**
 * Bildirim içerikleri yalnızca planlama bilgisi içerir.
 * Muayene, teşhis, tedavi notları ve hasta açıklaması hiçbir şablona eklenmez.
 */
export type AppointmentMessageData = {
  firstName: string;
  clinicName: string;
  date: string;
  time: string;
  dentist: string;
  clinicPhone?: string | null;
};

export type AdminRequestData = {
  clinicName: string;
  requesterName: string;
  date: string;
  time: string;
  dentist: string;
  serviceName?: string | null;
  panelUrl: string;
};

const contactLine = (phone?: string | null) =>
  phone ? `Değişiklik için kliniğimizle iletişime geçebilirsiniz (${phone}).` : "Değişiklik için kliniğimizle iletişime geçebilirsiniz.";

export function renderSms(template: Exclude<NotificationTemplate, "ADMIN_NEW_REQUEST">, d: AppointmentMessageData): string {
  switch (template) {
    case "PATIENT_CONFIRMED":
      return `Merhaba ${d.firstName}, ${d.clinicName} randevunuz onaylanmıştır. Tarih: ${d.date}, Saat: ${d.time}, Doktor: ${d.dentist}. Değişiklik için kliniğimizle iletişime geçebilirsiniz.`;
    case "PATIENT_REJECTED":
      return `Merhaba ${d.firstName}, ${d.clinicName} için ${d.date} ${d.time} tarihli randevu talebiniz maalesef onaylanamadı. Uygun bir zaman için kliniğimizle iletişime geçebilirsiniz.`;
    case "PATIENT_CANCELLED":
      return `Merhaba ${d.firstName}, ${d.clinicName} ${d.date} ${d.time} tarihli randevunuz iptal edilmiştir. Yeni randevu için kliniğimizle iletişime geçebilirsiniz.`;
    case "PATIENT_RESCHEDULED":
      return `Merhaba ${d.firstName}, ${d.clinicName} randevunuz güncellenmiştir. Yeni tarih: ${d.date}, Saat: ${d.time}, Doktor: ${d.dentist}. ${contactLine(null)}`;
  }
}

export function renderPatientEmail(
  template: Exclude<NotificationTemplate, "ADMIN_NEW_REQUEST">,
  d: AppointmentMessageData,
): { subject: string; text: string } {
  const footer = `\n\n${d.clinicName}\n${contactLine(d.clinicPhone)}\n\nBu e-posta randevu talebiniz nedeniyle gönderilmiştir.`;
  switch (template) {
    case "PATIENT_CONFIRMED":
      return {
        subject: `Randevunuz onaylandı – ${d.clinicName}`,
        text: `Merhaba ${d.firstName},\n\n${d.clinicName} randevunuz onaylanmıştır.\n\nTarih: ${d.date}\nSaat: ${d.time}\nDoktor: ${d.dentist}\n\nLütfen randevu saatinden birkaç dakika önce klinikte olunuz.${footer}`,
      };
    case "PATIENT_REJECTED":
      return {
        subject: `Randevu talebiniz hakkında – ${d.clinicName}`,
        text: `Merhaba ${d.firstName},\n\n${d.date} ${d.time} için oluşturduğunuz randevu talebi maalesef onaylanamadı. Size uygun başka bir zaman için kliniğimizle iletişime geçebilir veya web sitemizden yeni bir talep oluşturabilirsiniz.${footer}`,
      };
    case "PATIENT_CANCELLED":
      return {
        subject: `Randevunuz iptal edildi – ${d.clinicName}`,
        text: `Merhaba ${d.firstName},\n\n${d.date} ${d.time} tarihli ${d.dentist} randevunuz iptal edilmiştir.${footer}`,
      };
    case "PATIENT_RESCHEDULED":
      return {
        subject: `Randevunuz güncellendi – ${d.clinicName}`,
        text: `Merhaba ${d.firstName},\n\nRandevunuz yeniden planlanmıştır.\n\nYeni tarih: ${d.date}\nSaat: ${d.time}\nDoktor: ${d.dentist}${footer}`,
      };
  }
}

export function renderAdminRequestEmail(d: AdminRequestData): { subject: string; text: string } {
  return {
    subject: `Yeni randevu talebi – ${d.date} ${d.time}`,
    text: `${d.clinicName} için yeni bir online randevu talebi alındı.\n\nHasta: ${d.requesterName}\nTarih: ${d.date}\nSaat: ${d.time}\nDoktor: ${d.dentist}${d.serviceName ? `\nHizmet: ${d.serviceName}` : ""}\n\nTalebi onaylamak veya reddetmek için yönetim panelini kullanın:\n${d.panelUrl}\n\nİletişim bilgileri ve açıklamalar güvenlik nedeniyle yalnızca panelde gösterilir.`,
  };
}

export const TEMPLATE_LABELS: Record<NotificationTemplate, string> = {
  ADMIN_NEW_REQUEST: "Yeni talep (admin)",
  PATIENT_CONFIRMED: "Randevu onayı",
  PATIENT_REJECTED: "Talep reddi",
  PATIENT_CANCELLED: "Randevu iptali",
  PATIENT_RESCHEDULED: "Yeniden planlama",
};
