"use client";

import { format } from "date-fns";
import { tr } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export function keyToLocalDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Takvimden gün seçimi. Değer "yyyy-MM-dd" (klinik saat dilimindeki gün) olarak tutulur;
 * tarayıcı saat diliminden bağımsızdır.
 */
export function DateKeyPicker({
  value,
  onChange,
  minKey,
  maxKey,
  allowedWeekdays,
  className,
  id,
}: {
  value?: string;
  onChange: (key: string | undefined) => void;
  minKey?: string;
  maxKey?: string;
  /** ISO hafta günleri (1=Pzt … 7=Paz); verilmezse tüm günler seçilebilir */
  allowedWeekdays?: number[];
  className?: string;
  id?: string;
}) {
  const disabled = [
    ...(minKey ? [{ before: keyToLocalDate(minKey) }] : []),
    ...(maxKey ? [{ after: keyToLocalDate(maxKey) }] : []),
    ...(allowedWeekdays
      ? [{ dayOfWeek: [0, 1, 2, 3, 4, 5, 6].filter((js) => !allowedWeekdays.includes(js === 0 ? 7 : js)) }]
      : []),
  ];
  return (
    <Calendar
      id={id}
      mode="single"
      locale={tr}
      selected={value ? keyToLocalDate(value) : undefined}
      onSelect={(d) => onChange(d ? localDateToKey(d) : undefined)}
      disabled={disabled}
      defaultMonth={value ? keyToLocalDate(value) : minKey ? keyToLocalDate(minKey) : undefined}
      startMonth={minKey ? keyToLocalDate(minKey) : undefined}
      endMonth={maxKey ? keyToLocalDate(maxKey) : undefined}
      showOutsideDays={false}
      className={cn("rounded-xl border bg-card p-3 [--cell-size:--spacing(10)]", className)}
    />
  );
}
