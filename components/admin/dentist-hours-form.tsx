"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/forms/form-row";
import { setWorkingHoursAction } from "@/features/dentists/actions";
import { WEEKDAY_LABELS } from "@/lib/time";
import type { WorkingHoursInput } from "@/lib/validations/dentist";

type Day = WorkingHoursInput["days"][number];

export function DentistHoursForm({ dentistId, initialDays }: { dentistId: string; initialDays: Day[] }) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patch = (weekday: number, part: Partial<Day>) =>
    setDays((rows) => rows.map((d) => (d.weekday === weekday ? { ...d, ...part } : d)));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await setWorkingHoursAction({ dentistId, days });
          if (result.ok) {
            toast.success(result.message ?? "Kaydedildi.");
            router.refresh();
            return;
          }
          setError(result.error);
          toast.error(result.error);
        });
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2 font-medium">Gün</th>
              <th className="pb-2 font-medium">Açık</th>
              <th className="pb-2 font-medium">Başlangıç</th>
              <th className="pb-2 font-medium">Bitiş</th>
              <th className="pb-2 font-medium">Mola</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.weekday} className="border-t">
                <td className="py-2">{WEEKDAY_LABELS[d.weekday]}</td>
                <td>
                  <Checkbox checked={d.enabled} onCheckedChange={(v) => patch(d.weekday, { enabled: v === true })} />
                </td>
                <td>
                  <Input type="time" value={d.start} disabled={!d.enabled} onChange={(e) => patch(d.weekday, { start: e.target.value })} className="w-[7.5rem]" />
                </td>
                <td>
                  <Input type="time" value={d.end} disabled={!d.enabled} onChange={(e) => patch(d.weekday, { end: e.target.value })} className="w-[7.5rem]" />
                </td>
                <td className="flex gap-2 py-2">
                  <Input type="time" value={d.breakStart ?? ""} disabled={!d.enabled} onChange={(e) => patch(d.weekday, { breakStart: e.target.value })} className="w-[7.5rem]" aria-label="Mola başlangıç" />
                  <Input type="time" value={d.breakEnd ?? ""} disabled={!d.enabled} onChange={(e) => patch(d.weekday, { breakEnd: e.target.value })} className="w-[7.5rem]" aria-label="Mola bitiş" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormError message={error} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Programı kaydet
      </Button>
    </form>
  );
}
