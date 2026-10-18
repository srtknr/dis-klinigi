"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import FullCalendar, { type EventInput } from "@fullcalendar/react";
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
  const calendarRef = useRef<React.ComponentRef<typeof FullCalendar>>(null);

  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; events: EventInput[] }>({ key: "", events: [] });
  const requestKey = range ? `${range.start.getTime()}|${range.end.getTime()}|${dentistId}|${includeInactive}` : "";
  const loading = requestKey !== "" && loaded.key !== requestKey;

  // FullCalendar render sırasında olay kaynağı fonksiyonunu çağırdığı için (server action Router'ı
  // günceller → "setState in render" hatası) veriyi burada, effect içinde çekiyoruz.
  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    getCalendarEventsAction({
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      dentistId: dentistId || undefined,
      includeInactive,
    })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          toast.error(result.error);
          setLoaded({ key: requestKey, events: [] });
          return;
        }
        setLoaded({
          key: requestKey,
          events: result.data.map((e) => {
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
          }),
        });
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Takvim yüklenemedi.");
        setLoaded({ key: requestKey, events: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [range, requestKey, dentistId, includeInactive]);

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
          events={loaded.events}
          datesSet={(info) => {
            // Render aşamasında tetiklenebilir; state güncellemesini ertele.
            queueMicrotask(() =>
              setRange((prev) =>
                prev && prev.start.getTime() === info.start.getTime() && prev.end.getTime() === info.end.getTime()
                  ? prev
                  : { start: info.start, end: info.end },
              ),
            );
          }}
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
