"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormError, FormRow } from "@/components/forms/form-row";
import { DateKeyPicker } from "@/components/scheduling/date-key-picker";
import { SlotGrid } from "@/components/scheduling/slot-grid";
import { useStaffSlots } from "@/components/scheduling/use-staff-slots";
import { rescheduleAppointmentAction } from "@/features/appointments/actions";
import { dateKeyInTz, formatDateKeyLong } from "@/lib/time";

export function AppointmentRescheduleForm({
  appointmentId,
  dentists,
  currentDentistId,
  currentStartsAt,
}: {
  appointmentId: string;
  dentists: { id: string; name: string }[];
  currentDentistId: string;
  currentStartsAt: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dentistId, setDentistId] = useState(currentDentistId);
  const [date, setDate] = useState(dateKeyInTz(new Date(currentStartsAt)));
  const [startTime, setStartTime] = useState("");
  const [manual, setManual] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const slots = useStaffSlots(dentistId, date, appointmentId, reloadKey);

  const submit = () => {
    setError(null);
    if (!startTime) {
      setError("Yeni saati seçin.");
      return;
    }
    startTransition(async () => {
      const result = await rescheduleAppointmentAction({
        appointmentId,
        dentistId,
        date,
        startTime,
        overrideSchedule: manual,
        note: note || undefined,
      });
      if (result.ok) {
        toast.success(result.message ?? "Randevu yeniden planlandı.");
        setOpen(false);
        router.refresh();
        return;
      }
      setError(result.error);
      if (result.code === "CONFLICT") {
        setStartTime("");
        setReloadKey((k) => k + 1);
      }
      toast.error(result.error);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarClock aria-hidden /> Yeniden planla
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Randevuyu yeniden planla</DialogTitle>
          <DialogDescription>Onaylı randevularda hastaya yeni saat SMS ile bildirilir.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <FormRow id="rs-dentist" label="Doktor" className="sm:col-span-2">
            <NativeSelect
              id="rs-dentist"
              value={dentistId}
              onChange={(e) => {
                setDentistId(e.target.value);
                setStartTime("");
              }}
            >
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </FormRow>
          <DateKeyPicker
            value={date}
            onChange={(k) => {
              setDate(k ?? date);
              setStartTime("");
            }}
          />
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-medium">{formatDateKeyLong(date)}</p>
            {manual ? (
              <Input type="time" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-40" />
            ) : (
              <SlotGrid
                slots={slots.status === "ready" ? slots.slots : []}
                value={startTime}
                onChange={setStartTime}
                loading={slots.status === "loading"}
                error={slots.status === "error" ? slots.message : null}
                emptyMessage={slots.status === "ready" ? slots.closedReason : "Uygun saat yok."}
              />
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={manual} onCheckedChange={(v) => setManual(v === true)} />
              Manuel saat (çakışma yine kontrol edilir)
            </label>
            <Textarea rows={2} placeholder="Dahili not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
