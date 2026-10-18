"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormError, FormRow } from "@/components/forms/form-row";
import { addBlockedTimeAction, removeBlockedTimeAction } from "@/features/dentists/actions";
import { handleActionResult } from "@/lib/client/action-result";

const TYPES = [
  { value: "LEAVE", label: "İzin" },
  { value: "BREAK", label: "Mola / kapalı saat" },
  { value: "OTHER", label: "Diğer" },
] as const;

export function DentistBlockedForm({ dentistId }: { dentistId: string }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("LEAVE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addBlockedTimeAction({
            dentistId,
            type,
            startDate,
            endDate: endDate || startDate,
            allDay,
            startTime: allDay ? undefined : startTime,
            endTime: allDay ? undefined : endTime,
            reason: reason || undefined,
          });
          if (result.ok) {
            const extra =
              result.data.conflictingAppointments > 0
                ? ` Bu aralıkta ${result.data.conflictingAppointments} aktif randevu var; lütfen onları yeniden planlayın.`
                : "";
            toast.success((result.message ?? "Eklendi.") + extra);
            setReason("");
            router.refresh();
            return;
          }
          setError(result.error);
          toast.error(result.error);
        });
      }}
    >
      <FormRow id="bt-type" label="Tür">
        <NativeSelect id="bt-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
      </FormRow>
      <FormRow id="bt-reason" label="Açıklama">
        <Input id="bt-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormRow>
      <FormRow id="bt-start" label="Başlangıç tarihi" required>
        <Input id="bt-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </FormRow>
      <FormRow id="bt-end" label="Bitiş tarihi" required>
        <Input id="bt-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </FormRow>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} />
        Tüm gün
      </label>
      {!allDay ? (
        <>
          <FormRow id="bt-st" label="Saat (baş)">
            <Input id="bt-st" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </FormRow>
          <FormRow id="bt-et" label="Saat (bitiş)">
            <Input id="bt-et" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </FormRow>
        </>
      ) : null}
      <div className="sm:col-span-2">
        <FormError message={error} />
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Ekle
        </Button>
      </div>
    </form>
  );
}

export function RemoveBlockedButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeBlockedTimeAction(id);
          if (handleActionResult(result)) router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
      Kaldır
    </Button>
  );
}
