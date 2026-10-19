"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import FullCalendar, { type EventInput } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import listPlugin from "@fullcalendar/react/list";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import trLocale from "@fullcalendar/react/locales/tr";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import { CalendarClock, ExternalLink, Phone, Stethoscope, StickyNote, UserRound, X } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { AppointmentStatusBadge } from "@/components/shared/status-badge";
import { formatPhone } from "@/lib/phone";
import { dateKeyInTz, formatLongDate, formatTime } from "@/lib/time";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { getCalendarEventsAction } from "@/features/appointments/actions";
import type { CalendarView } from "@/features/appointments/calendar-views";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatusKey } from "@/features/appointments/status";

const STATUS_COLORS: Record<AppointmentStatusKey, { bg: string; border: string; text: string }> = {
  PENDING: { bg: "#f6ead3", border: "#d9b97a", text: "#5f4312" },
  CONFIRMED: { bg: "#e6ece1", border: "#7d8f74", text: "#33432d" },
  COMPLETED: { bg: "#e5e7ea", border: "#9aa3ad", text: "#3d4651" },
  NO_SHOW: { bg: "#f5e1da", border: "#c98a77", text: "#7a2f1f" },
  CANCELLED: { bg: "#f2ebe2", border: "#cbbcab", text: "#6b5f55" },
  REJECTED: { bg: "#f2ebe2", border: "#cbbcab", text: "#6b5f55" },
};

type SelectedEvent = {
  id: string;
  el: HTMLElement;
  status: AppointmentStatusKey;
  start: Date;
  end: Date;
  personName: string;
  serviceName: string | null;
  dentistName: string;
  phone: string;
  reason: string | null;
};

export function AppointmentCalendar({
  dentists,
  initialDate,
  initialView = "timeGridWeek",
}: {
  dentists: { id: string; name: string }[];
  initialDate?: string;
  initialView?: CalendarView;
}) {
  const [dentistId, setDentistId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const calendarRef = useRef<React.ComponentRef<typeof FullCalendar>>(null);

  const [selected, setSelected] = useState<SelectedEvent | null>(null);
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
              // FullCalendar v7: backgroundColor/borderColor/textColor yerine color + contrastColor
              color: c.bg,
              contrastColor: c.text,
              extendedProps: {
                status: e.status,
                personName: e.personName,
                serviceName: e.serviceName,
                dentistName: e.dentistName,
                phone: e.phone,
                reason: e.reason,
              },
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
          initialView={initialView}
          initialDate={initialDate}
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
            // Detay sayfasından dönüşte (geri tuşu / "Randevular" bağlantısı) aynı görünüm açılsın diye
            // tarih ve görünümü URL'e yaz. Render sırasında çağrılabileceği için ertelenir.
            const date = dateKeyInTz(info.view.currentStart);
            const view = info.view.type;
            queueMicrotask(() => {
              const url = new URL(window.location.href);
              if (url.searchParams.get("tarih") === date && url.searchParams.get("gorunum") === view) return;
              url.searchParams.set("tarih", date);
              url.searchParams.set("gorunum", view);
              window.history.replaceState(window.history.state, "", url);
            });
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
            const p = info.event.extendedProps;
            setSelected({
              id: info.event.id,
              el: info.el,
              status: p.status,
              start: info.event.start!,
              end: info.event.end ?? info.event.start!,
              personName: p.personName,
              serviceName: p.serviceName,
              dentistName: p.dentistName,
              phone: p.phone,
              reason: p.reason,
            });
          }}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotHeaderFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        />
      </div>

      <Popover open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected ? <PopoverAnchor virtualRef={{ current: selected.el }} /> : null}
        <PopoverContent align="start" side="right" collisionPadding={16} className="w-80 gap-3 p-4">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5">
                  <h3 className="text-base leading-tight font-semibold">{selected.personName}</h3>
                  <AppointmentStatusBadge status={selected.status} />
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSelected(null)} aria-label="Kapat">
                  <X aria-hidden />
                </Button>
              </div>
              <dl className="space-y-2 text-sm">
                <PopupRow icon={CalendarClock}>
                  {formatLongDate(selected.start)}
                  <br />
                  {formatTime(selected.start)} – {formatTime(selected.end)}
                </PopupRow>
                <PopupRow icon={Stethoscope}>
                  {selected.dentistName}
                  {selected.serviceName ? ` · ${selected.serviceName}` : ""}
                </PopupRow>
                <PopupRow icon={Phone}>
                  <a href={`tel:${selected.phone}`} className="hover:underline">
                    {formatPhone(selected.phone)}
                  </a>
                </PopupRow>
                {selected.reason ? (
                  <PopupRow icon={StickyNote}>
                    <span className="line-clamp-3">{selected.reason}</span>
                  </PopupRow>
                ) : null}
              </dl>
              <Button asChild size="sm" className="w-full">
                <Link href={`/admin/randevular/${selected.id}?geri=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
                  <ExternalLink aria-hidden /> Detayı gör
                </Link>
              </Button>
            </>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function PopupRow({ icon: Icon, children }: { icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
