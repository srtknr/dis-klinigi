"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormError, FormRow } from "@/components/forms/form-row";
import { createDentistAction, updateDentistAction } from "@/features/dentists/actions";

type Values = {
  title: string;
  firstName: string;
  lastName: string;
  specialty: string;
  bio: string;
  slotMinutes: number;
  isActive: boolean;
  acceptsOnlineBooking: boolean;
  sortOrder: number;
};

export function DentistProfileForm({ dentistId, initial }: { dentistId?: string; initial: Values }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
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
          const payload = { ...values, bio: values.bio || undefined, dentistId };
          const result = dentistId ? await updateDentistAction(payload) : await createDentistAction(payload);
          if (result.ok) {
            toast.success(result.message ?? "Kaydedildi.");
            router.push(`/admin/doktorlar/${result.data.dentistId}`);
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
      <div className="grid gap-4 sm:grid-cols-3">
        <FormRow id="title" label="Unvan" required error={errors.title}>
          <Input id="title" value={values.title} onChange={(e) => set("title", e.target.value)} />
        </FormRow>
        <FormRow id="firstName" label="Ad" required error={errors.firstName} className="sm:col-span-1">
          <Input id="firstName" value={values.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </FormRow>
        <FormRow id="lastName" label="Soyad" required error={errors.lastName}>
          <Input id="lastName" value={values.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </FormRow>
      </div>
      <FormRow id="specialty" label="Uzmanlık" required error={errors.specialty}>
        <Input id="specialty" value={values.specialty} onChange={(e) => set("specialty", e.target.value)} />
      </FormRow>
      <FormRow id="bio" label="Biyografi (web sitesi)" error={errors.bio}>
        <Textarea id="bio" rows={5} value={values.bio} onChange={(e) => set("bio", e.target.value)} />
      </FormRow>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow id="slotMinutes" label="Varsayılan seans (dk)" error={errors.slotMinutes}>
          <Input id="slotMinutes" type="number" min={10} max={240} value={values.slotMinutes} onChange={(e) => set("slotMinutes", Number(e.target.value))} />
        </FormRow>
        <FormRow id="sortOrder" label="Sıra" error={errors.sortOrder}>
          <Input id="sortOrder" type="number" min={0} value={values.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} />
        </FormRow>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={values.isActive} onCheckedChange={(v) => set("isActive", v === true)} />
        Aktif (web sitesinde ve randevu listesinde görünür)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={values.acceptsOnlineBooking} onCheckedChange={(v) => set("acceptsOnlineBooking", v === true)} />
        Online randevu kabul eder
      </label>
      <FormError message={formError} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Kaydet
      </Button>
    </form>
  );
}
