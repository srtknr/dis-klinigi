"use client";

import { CalendarX2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SlotOption = { time: string };

export function SlotGrid({
  slots,
  value,
  onChange,
  loading,
  error,
  emptyMessage,
  labelledBy,
}: {
  slots: SlotOption[];
  value?: string;
  onChange: (time: string) => void;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string | null;
  labelledBy?: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Uygun saatler yükleniyor…
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-[#ecc9bd] bg-danger-soft px-4 py-4 text-sm text-danger-foreground">
        {error}
      </div>
    );
  }
  if (slots.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed bg-card/60 px-4 py-6 text-sm text-muted-foreground">
        <CalendarX2 className="size-4 shrink-0" aria-hidden />
        {emptyMessage ?? "Bu tarihte uygun saat bulunmuyor."}
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
      {slots.map((slot) => {
        const selected = slot.time === value;
        return (
          <button
            key={slot.time}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(slot.time)}
            className={cn(
              "h-11 rounded-lg border text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-ring hover:bg-muted",
            )}
          >
            {slot.time}
          </button>
        );
      })}
    </div>
  );
}
