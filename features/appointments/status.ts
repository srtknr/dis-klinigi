import type { AppointmentStatus } from "@/generated/prisma/enums";

export type AppointmentStatusKey = AppointmentStatus;

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatusKey, string> = {
  PENDING: "Onay bekliyor",
  CONFIRMED: "Onaylandı",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal edildi",
  COMPLETED: "Tamamlandı",
  NO_SHOW: "Gelmedi",
};

/** Rozet renkleri (tasarım sistemindeki yardımcı tonlar) */
export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatusKey, "warning" | "success" | "danger" | "muted" | "info" | "neutral"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  REJECTED: "danger",
  CANCELLED: "muted",
  COMPLETED: "info",
  NO_SHOW: "danger",
};

export type AppointmentAction = "confirm" | "reject" | "cancel" | "reschedule" | "complete" | "no_show";

/** İzin verilen durum geçişleri */
export const TRANSITIONS: Record<AppointmentAction, { from: AppointmentStatusKey[]; to: AppointmentStatusKey | null }> = {
  confirm: { from: ["PENDING"], to: "CONFIRMED" },
  reject: { from: ["PENDING"], to: "REJECTED" },
  cancel: { from: ["PENDING", "CONFIRMED"], to: "CANCELLED" },
  reschedule: { from: ["PENDING", "CONFIRMED"], to: null },
  complete: { from: ["CONFIRMED"], to: "COMPLETED" },
  no_show: { from: ["CONFIRMED"], to: "NO_SHOW" },
};

export function canTransition(action: AppointmentAction, status: AppointmentStatusKey): boolean {
  return TRANSITIONS[action].from.includes(status);
}

export function availableActions(status: AppointmentStatusKey): AppointmentAction[] {
  return (Object.keys(TRANSITIONS) as AppointmentAction[]).filter((a) => canTransition(a, status));
}

export const HISTORY_EVENT_LABELS: Record<string, string> = {
  REQUESTED: "Online talep oluşturuldu",
  CREATED: "Panelden oluşturuldu",
  CONFIRMED: "Onaylandı",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal edildi",
  RESCHEDULED: "Yeniden planlandı",
  COMPLETED: "Tamamlandı",
  NO_SHOW: "Gelmedi olarak işaretlendi",
  PATIENT_LINKED: "Hasta kaydıyla eşleştirildi",
};

export const ALL_STATUSES: AppointmentStatusKey[] = ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW"];
