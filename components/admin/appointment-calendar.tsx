"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import FullCalendar, { type EventInput, type EventSourceFuncInfo } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import listPlugin from "@fullcalendar/react/list";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import trLocale from "@fullcalendar/react/locales/tr";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { getCalendarEventsAction } from "@/features/appointments/actions";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatusKey } from "@/features/appointments/status";

const STATUS_COLORS: Record<AppointmentStatusKey, { bg: string; border: string; text: string }> = {
  PENDING: { bg: "#f6ead3", border: "#d9b97a", text: "#5f4312" },
  CONFIRMED: { bg: "#e6ece1", border: "#7d8f74", text: "#33432d" },
  COMPLETED: { bg: "#e5e7ea", border: "#9aa3ad", text: "#3d4651" },
  NO_SHOW: { bg: "#f5e1da", border: "#c98a77", text: "#7a2f1f" },
  CANCELLED: { bg: "#f2ebe2", border: "#cbbcab", text: "#6b5f55" },
  REJECTED: { bg: "#f2ebe2", border: "#cbbcab", text: "#6b5f55" },
};

export function AppointmentCalendar({ dentists }: { dentists: { id: string; name: string }[] }) {
  const router = useRouter();
  const [dentistId, setDentistId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const calendarRef = useRef<React.ComponentRef<typeof FullCalendar>>(null);

  const fetchEvents = useCallback(
    async (info: EventSourceFuncInfo): Promise<EventInput[]> => {
      const result = await getCalendarEventsAction({
        from: info.start.toISOString(),
        to: info.end.toISOString(),
        dentistId: dentistId || undefined,
        includeInactive,
      });
      if (!result.ok) {
        toast.error(result.error);
        return [];
      }
      return result.data.map((e) => {
        const c = STATUS_COLORS[e.status];
        return {
          id: e.id,
          title: dentistId ? e.title : `${e.title} — ${e.dentistName}`,
          start: e.start,
          end: e.end,
          backgroundColor: c.bg,
          borderColor: c.border,
          textColor: c.text,
          extendedProps: { status: e.status },
        };
      });
    },
    [dentistId, includeInactive],
  );

  const eventSources = useMemo(() => [{ events: fetchEvents }], [fetchEvents]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <NativeSelect value={dentistId} onChange={(e) => setDentistId(e.target.value)} aria-label="Doktor filtresi" className="w-full sm:w-64">
          <option value="">Tüm doktorlar</option>
          {dentists.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={includeInactive} onCheckedChange={(v) => setIncludeInactive(v === true)} />
          İptal / reddedilenleri göster
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {loading ? (
            <span className="flex items-center gap-1.5" role="status">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Yükleniyor
            </span>
          ) : null}
          {(["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border" style={{ background: STATUS_COLORS[s].bg, borderColor: STATUS_COLORS[s].border }} aria-hidden />
              {APPOINTMENT_STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="dk-calendar overflow-hidden rounded-xl border bg-card p-3 sm:p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, classicThemePlugin]}
          locale={trLocale}
          timeZone="Europe/Istanbul"
          initialView="timeGridWeek"
          headerToolbar={{ start: "prev,next today", center: "title", end: "timeGridDay,timeGridWeek,dayGridMonth,listWeek" }}
          firstDay={1}
          nowIndicator
          allDaySlot={false}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          slotDuration="00:15:00"
          scrollTime="09:00:00"
          height="auto"
          expandRows
          dayMaxEvents={4}
          eventSources={eventSources}
          loading={setLoading}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            router.push(`/admin/randevular/${info.event.id}`);
          }}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotHeaderFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        />
      </div>
    </div>
  );
}
