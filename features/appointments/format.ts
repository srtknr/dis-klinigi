type NameSource = {
  requesterFirstName: string;
  requesterLastName: string;
  patient?: { firstName: string; lastName: string } | null;
};

/** Hasta kaydı bağlıysa hasta adı, değilse talep sahibinin adı */
export function appointmentPersonName(a: NameSource): string {
  return a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : `${a.requesterFirstName} ${a.requesterLastName}`;
}

export const SOURCE_LABELS: Record<string, string> = {
  PUBLIC_WEBSITE: "Web sitesi",
  ADMIN_PANEL: "Panel",
};
