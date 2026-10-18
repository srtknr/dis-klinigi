"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormError, FormRow } from "@/components/forms/form-row";
import { createTreatmentAction, updateTreatmentAction, voidTreatmentAction } from "@/features/treatments/actions";
import { handleActionResult } from "@/lib/client/action-result";

type Values = {
  dentistId: string;
  appointmentId: string;
  visitDate: string;
  procedure: string;
  examinationNote: string;
  nextVisitPlan: string;
  nextVisitTodo: string;
};

export function TreatmentForm({
  patientId,
  recordId,
  dentists,
  appointments,
  initial,
  canVoid,
}: {
  patientId: string;
  recordId?: string;
  dentists: { id: string; name: string }[];
  appointments: { id: string; label: string }[];
  initial: Values;
  canVoid?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [changeReason, setChangeReason] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <form
      className="max-w-2xl space-y-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        startTransition(async () => {
          const payload = {
            ...values,
            appointmentId: values.appointmentId || undefined,
            examinationNote: values.examinationNote || undefined,
            nextVisitPlan: values.nextVisitPlan || undefined,
            nextVisitTodo: values.nextVisitTodo || undefined,
            patientId,
            recordId,
            changeReason,
          };
          const result = recordId ? await updateTreatmentAction(payload) : await createTreatmentAction(payload);
          if (result.ok) {
            toast.success(result.message ?? "Kaydedildi.");
            router.push(`/admin/hastalar/${result.data.patientId}`);
            router.refresh();
            return;
          }
          const fe: Record<string, string> = {};
          for (const [k, v] of Object.entries(result.fieldErrors ?? {})) fe[k] = v[0];
          setErrors(fe);
          setFormError(result.error);
          toast.error(result.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow id="dentistId" label="Doktor" required error={errors.dentistId}>
          <NativeSelect id="dentistId" value={values.dentistId} onChange={(e) => set("dentistId", e.target.value)}>
            <option value="">Seçiniz</option>
            {dentists.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </FormRow>
        <FormRow id="visitDate" label="Ziyaret tarihi" required error={errors.visitDate}>
          <Input id="visitDate" type="date" value={values.visitDate} onChange={(e) => set("visitDate", e.target.value)} />
        </FormRow>
        <FormRow id="appointmentId" label="İlgili randevu" error={errors.appointmentId} className="sm:col-span-2">
          <NativeSelect id="appointmentId" value={values.appointmentId} onChange={(e) => set("appointmentId", e.target.value)}>
            <option value="">Bağlama</option>
            {appointments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
        </FormRow>
      </div>
      <FormRow id="procedure" label="Yapılan işlem" required error={errors.procedure}>
        <Input id="procedure" value={values.procedure} onChange={(e) => set("procedure", e.target.value)} />
      </FormRow>
      <FormRow id="examinationNote" label="Muayene notu" error={errors.examinationNote}>
        <Textarea id="examinationNote" rows={6} value={values.examinationNote} onChange={(e) => set("examinationNote", e.target.value)} />
      </FormRow>
      <FormRow id="nextVisitPlan" label="Sonraki ziyaret planı" error={errors.nextVisitPlan}>
        <Input id="nextVisitPlan" value={values.nextVisitPlan} onChange={(e) => set("nextVisitPlan", e.target.value)} />
      </FormRow>
      <FormRow id="nextVisitTodo" label="Sonraki randevuda yapılacaklar" error={errors.nextVisitTodo}>
        <Textarea id="nextVisitTodo" rows={3} value={values.nextVisitTodo} onChange={(e) => set("nextVisitTodo", e.target.value)} />
      </FormRow>
      {recordId ? (
        <FormRow id="changeReason" label="Düzeltme nedeni" required error={errors.changeReason} description="Önceki sürüm saklanır; içerik denetim kaydına yazılmaz.">
          <Textarea id="changeReason" rows={2} value={changeReason} onChange={(e) => setChangeReason(e.target.value)} />
        </FormRow>
      ) : null}
      <FormError message={formError} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Kaydet
      </Button>
      {recordId && canVoid ? (
        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">Geçersiz kıl (silme yoktur)</p>
          <Textarea rows={2} placeholder="Neden" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          <Button
            type="button"
            variant="destructive"
            className="mt-2"
            disabled={pending || voidReason.trim().length < 5}
            onClick={() =>
              startTransition(async () => {
                const result = await voidTreatmentAction({ recordId, reason: voidReason });
                if (handleActionResult(result)) {
                  router.push(`/admin/hastalar/${patientId}`);
                  router.refresh();
                }
              })
            }
          >
            Kaydı geçersiz kıl
          </Button>
        </div>
      ) : null}
    </form>
  );
}
