import { sha256Hex } from "@/lib/crypto";
import { CLINIC_TZ } from "@/lib/time";

/**
 * Google etkinlik kimliği base32hex karakterleri (0-9, a-v) içermelidir. SHA-256 hex çıktısı bu kümeye
 * uyar; randevu + bağlantı çiftinden deterministik üretildiği için aynı randevu için ikinci bir
 * etkinlik oluşturulamaz (Google 409 döner ve güncellemeye geçilir).
 */
export function googleEventIdFor(appointmentId: string, connectionId: string): string {
  return `dk${sha256Hex(`${appointmentId}:${connectionId}`).slice(0, 40)}`;
}

export type EventSource = {
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  patientFirstName: string;
  patientLastName: string;
  dentistName: string;
  clinicName: string;
  appUrl: string;
};

/**
 * Takvim etkinliği yalnızca planlama için gerekli bilgileri içerir.
 * Telefon, e-posta, randevu nedeni, hasta açıklaması ve klinik notlar yazılmaz.
 */
export function buildEventPayload(eventId: string, src: EventSource) {
  const lastInitial = src.patientLastName.trim().charAt(0).toLocaleUpperCase("tr-TR");
  return {
    id: eventId,
    summary: `Randevu: ${src.patientFirstName} ${lastInitial}. — ${src.dentistName}`,
    description: `${src.clinicName} randevusu. Ayrıntılar yalnızca klinik panelinde görüntülenir:\n${src.appUrl}/admin/randevular/${src.appointmentId}`,
    start: { dateTime: src.startsAt.toISOString(), timeZone: CLINIC_TZ },
    end: { dateTime: src.endsAt.toISOString(), timeZone: CLINIC_TZ },
    status: "confirmed",
    transparency: "opaque",
    visibility: "private",
    reminders: { useDefault: true },
    extendedProperties: { private: { appointmentId: src.appointmentId, source: "dis-klinigi" } },
  };
}
