"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FormError, FormRow } from "@/components/forms/form-row";
import { PatientPicker, type PickedPatient } from "@/components/admin/patient-picker";
import { DateKeyPicker } from "@/components/scheduling/date-key-picker";
import { SlotGrid } from "@/components/scheduling/slot-grid";
import { useStaffSlots } from "@/components/scheduling/use-staff-slots";
import { createAppointmentAction } from "@/features/appointments/actions";
import { formatDateKeyLong } from "@/lib/time";

type Props = {
  dentists: { id: string; name: string; slotMinutes: number }[];
  services: { id: string; name: string; durationMinutes: number | null }[];
  canConfirm: boolean;
  canSearchPatients: boolean;
  canCreatePatient: boolean;
  initialPatient?: PickedPatient | null;
  todayKey: string;
};

type Errors = Record<string, string | undefined>;

export function AppointmentCreateForm({ dentists, services, canConfirm, canSearchPatients, canCreatePatient, initialPatient, todayKey }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">(canSearchPatients ? "existing" : "new");
  const [patient, setPatient] = useState<PickedPatient | null>(initialPatient ?? null);
  const [newPatient, setNewPatient] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [dentistId, setDentistId] = useState(dentists.length === 1 ? dentists[0].id : "");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [manualTime, setManualTime] = useState(false);
  const [duration, setDuration] = useState("");
  const [reason, setReason] = useState("");
  const [confirmNow, setConfirmNow] = useState(canConfirm);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<{ id: string; name: string }[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const slots = useStaffSlots(dentistId, date, undefined, reloadKey);
  const dentist = dentists.find((d) => d.id === dentistId);
  const service = services.find((s) => s.id === serviceId);
  const effectiveDuration = Number(duration) || service?.durationMinutes || dentist?.slotMinutes || 30;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Errors = {};
    if (mode === "existing" && !patient) local["patient.patientId"] = "Bir hasta seçin.";
    if (!dentistId) local.dentistId = "Doktor seçin.";
    if (!date) local.date = "Tarih seçin.";
    if (!startTime) local.startTime = "Saat seçin.";
    setErrors(local);
    setFormError(null);
    setDuplicates([]);
    if (Object.keys(local).length > 0) return;

    startTransition(async () => {
      const result = await createAppointmentAction({
        patient: mode === "existing" ? { mode, patientId: patient!.id } : { mode, ...newPatient },
        dentistId,
        serviceId: serviceId || undefined,
        date,
        startTime,
        durationMinutes: duration ? Number(duration) : undefined,
        reason: reason || undefined,
        overrideSchedule: manualTime,
        confirmNow,
      });
      if (result.ok) {
        toast.success(result.message ?? "Randevu oluşturuldu.");
        router.push(`/admin/randevular/${result.data.appointmentId}`);
        return;
      }
      const fe: Errors = {};
      for (const [k, v] of Object.entries(result.fieldErrors ?? {})) fe[k] = v[0];
      setErrors(fe);
      setFormError(result.error);
      if (result.code === "DUPLICATE_PATIENT" && Array.isArray(result.details?.candidates)) {
        setDuplicates(result.details.candidates as { id: string; name: string }[]);
      }
      if (result.code === "CONFLICT") {
        setStartTime("");
        setReloadKey((k) => k + 1);
      }
      toast.error(result.error);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="space-y-5 rounded-xl border bg-card p-5">
        <h2 className="font-medium">Hasta</h2>
        {canSearchPatients && canCreatePatient ? (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
            <TabsList>
              <TabsTrigger value="existing">Kayıtlı hasta</TabsTrigger>
              <TabsTrigger value="new">Yeni hasta</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}

        {mode === "existing" ? (
          <FormRow id="patient-search" label="Hasta seçin" required error={errors["patient.patientId"]}>
            <PatientPicker id="patient-search" value={patient} onChange={setPatient} invalid={!!errors["patient.patientId"]} />
          </FormRow>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["firstName", "Ad", "given-name"],
                ["lastName", "Soyad", "family-name"],
                ["phone", "Cep telefonu", "tel"],
                ["email", "E-posta (isteğe bağlı)", "email"],
              ] as const
            ).map(([key, label, ac]) => (
              <FormRow key={key} id={`np-${key}`} label={label} required={key !== "email"} error={errors[`patient.${key}`]}>
                <Input
                  id={`np-${key}`}
                  type={key === "phone" ? "tel" : key === "email" ? "email" : "text"}
                  autoComplete={ac}
                  value={newPatient[key]}
                  aria-invalid={!!errors[`patient.${key}`]}
                  onChange={(e) => setNewPatient((p) => ({ ...p, [key]: e.target.value }))}
                />
              </FormRow>
            ))}
          </div>
        )}

        {duplicates.length > 0 ? (
          <div className="rounded-lg border border-[#ead7b3] bg-warning-soft p-4 text-sm text-warning-foreground">
            <p className="font-medium">Bu telefonla kayıtlı hasta(lar) bulundu:</p>
            <ul className="mt-2 space-y-1">
              {duplicates.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span>{d.name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPatient({ id: d.id, name: d.name, phone: newPatient.phone });
                      setMode("existing");
                      setDuplicates([]);
                    }}
                  >
                    Bu hastayı seç
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow id="dentistId" label="Doktor" required error={errors.dentistId}>
            <NativeSelect
              id="dentistId"
              value={dentistId}
              aria-invalid={!!errors.dentistId}
              onChange={(e) => {
                setDentistId(e.target.value);
                setStartTime("");
              }}
            >
              <option value="">Seçiniz</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </FormRow>
          <FormRow id="serviceId" label="Hizmet">
            <NativeSelect id="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Belirtilmedi</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </FormRow>
          <FormRow id="duration" label="Süre (dk)" description={`Boş bırakılırsa ${effectiveDuration} dk kullanılır.`} error={errors.durationMinutes}>
            <Input id="duration" type="number" min={10} max={240} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </FormRow>
        </div>
        <FormRow id="reason" label="Randevu nedeni / kısa not" error={errors.reason}>
          <Textarea id="reason" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormRow>
      </section>

      <section className="space-y-5 rounded-xl border bg-card p-5">
        <h2 className="font-medium">Tarih ve saat</h2>
        <div className="grid gap-5 xl:grid-cols-[auto_1fr]">
          <div>
            <DateKeyPicker
              value={date || undefined}
              onChange={(k) => {
                setDate(k ?? "");
                setStartTime("");
              }}
              minKey={todayKey}
            />
            {errors.date ? <p role="alert" className="mt-2 text-sm text-destructive">{errors.date}</p> : null}
          </div>
          <div className="min-w-0 space-y-3">
            <p id="slot-label" className="text-sm font-medium">
              {date ? formatDateKeyLong(date) : "Bir gün seçin"}
            </p>
            {manualTime ? (
              <FormRow id="manualTime" label="Başlangıç saati" error={errors.startTime}>
                <Input id="manualTime" type="time" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-40" />
              </FormRow>
            ) : date && dentistId ? (
              <SlotGrid
                labelledBy="slot-label"
                slots={slots.status === "ready" ? slots.slots : []}
                value={startTime}
                onChange={setStartTime}
                loading={slots.status === "loading"}
                error={slots.status === "error" ? slots.message : null}
                emptyMessage={slots.status === "ready" ? slots.closedReason : null}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Uygun saatleri görmek için doktor ve gün seçin.</p>
            )}
            {!manualTime && errors.startTime ? <p role="alert" className="text-sm text-destructive">{errors.startTime}</p> : null}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={manualTime}
                onCheckedChange={(v) => {
                  setManualTime(v === true);
                  setStartTime("");
                }}
                className="mt-0.5"
              />
              <span>
                Çalışma saati dışında / manuel saat gir
                <span className="block text-xs text-muted-foreground">Diğer randevularla çakışma kontrolü yine yapılır.</span>
              </span>
            </label>
          </div>
        </div>

        {canConfirm ? (
          <label className="flex items-start gap-2 rounded-lg border bg-background p-4 text-sm">
            <Checkbox checked={confirmNow} onCheckedChange={(v) => setConfirmNow(v === true)} className="mt-0.5" />
            <span>
              Randevuyu doğrudan onaylı oluştur
              <span className="block text-xs text-muted-foreground">Onaylı randevularda hastaya SMS (ve varsa e-posta) bildirimi gönderilir.</span>
            </span>
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">Randevu “onay bekliyor” durumunda oluşturulur.</p>
        )}

        <FormError message={formError} />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            Randevuyu oluştur
          </Button>
        </div>
      </section>
    </form>
  );
}
