"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormRow } from "@/components/forms/form-row";
import { createPatientAction, updatePatientAction } from "@/features/patients/actions";
import { dateOnlyToKey } from "@/lib/time";

type Values = { firstName: string; lastName: string; phone: string; email: string; birthDate: string };

export function PatientForm({
  patientId,
  initial,
}: {
  patientId?: string;
  initial: Values;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [duplicates, setDuplicates] = useState<{ id: string; name: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <form
      className="max-w-xl space-y-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        startTransition(async () => {
          const payload = { ...values, email: values.email || undefined, birthDate: values.birthDate || undefined, confirmDuplicate, patientId };
          const result = patientId ? await updatePatientAction(payload) : await createPatientAction(payload);
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
          if (result.code === "DUPLICATE_PATIENT" && Array.isArray(result.details?.candidates)) {
            setDuplicates(result.details.candidates as { id: string; name: string }[]);
            setConfirmDuplicate(true);
          }
          toast.error(result.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow id="firstName" label="Ad" required error={errors.firstName}>
          <Input id="firstName" value={values.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </FormRow>
        <FormRow id="lastName" label="Soyad" required error={errors.lastName}>
          <Input id="lastName" value={values.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </FormRow>
        <FormRow id="phone" label="Telefon" required error={errors.phone}>
          <Input id="phone" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </FormRow>
        <FormRow id="email" label="E-posta" error={errors.email}>
          <Input id="email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />
        </FormRow>
        <FormRow id="birthDate" label="Doğum tarihi" error={errors.birthDate}>
          <Input id="birthDate" type="date" value={values.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        </FormRow>
      </div>
      {duplicates.length > 0 ? (
        <div className="rounded-lg border border-[#ead7b3] bg-warning-soft p-4 text-sm text-warning-foreground">
          <p className="font-medium">Aynı telefonla kayıtlı hasta(lar):</p>
          <ul className="mt-2 space-y-1">
            {duplicates.map((d) => (
              <li key={d.id}>
                <Button type="button" variant="link" className="h-auto p-0" onClick={() => router.push(`/admin/hastalar/${d.id}`)}>
                  {d.name}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2">Farklı bir kişi olduğunu onaylıyorsanız formu tekrar gönderin.</p>
        </div>
      ) : null}
      <FormError message={formError} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Kaydet
      </Button>
    </form>
  );
}

export function birthDateKey(date: Date | null | undefined): string {
  return date ? dateOnlyToKey(date) : "";
}
