import { cn } from "@/lib/utils";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
  type AppointmentStatusKey,
} from "@/features/appointments/status";

export type Tone = "warning" | "success" | "danger" | "muted" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  warning: "bg-warning-soft text-warning-foreground border-[#ead7b3]",
  success: "bg-sage-soft text-[#3f5238] border-[#cfdac7]",
  danger: "bg-danger-soft text-danger-foreground border-[#ecc9bd]",
  muted: "bg-muted text-muted-foreground border-border",
  info: "bg-info-soft text-info-foreground border-[#d3d7dc]",
  neutral: "bg-secondary text-secondary-foreground border-border",
};

export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AppointmentStatusBadge({ status, className }: { status: AppointmentStatusKey; className?: string }) {
  return (
    <ToneBadge tone={APPOINTMENT_STATUS_TONES[status]} className={className}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {APPOINTMENT_STATUS_LABELS[status]}
    </ToneBadge>
  );
}

/** Hastanın WhatsApp hatırlatmasına verdiği yanıt */
export function AttendanceBadge({ response, className }: { response: "YES" | "NO"; className?: string }) {
  return (
    <ToneBadge tone={response === "YES" ? "success" : "danger"} className={className}>
      {response === "YES" ? "Geleceğini bildirdi" : "Gelemeyeceğini bildirdi"}
    </ToneBadge>
  );
}
