"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormError, FormRow } from "@/components/forms/form-row";
import { updateClinicAction } from "@/features/clinic/actions";
import type { ClinicInput } from "@/lib/validations/clinic";

export function ClinicSettingsForm({ initial }: { initial: ClinicInput }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof ClinicInput, v: string) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        startTransition(async () => {
          const result = await updateClinicAction(values);
          if (result.ok) {
            toast.success(result.message);
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
      <h2 className="font-medium">Klinik bilgileri</h2>
      {(
        [
          ["name", "Klinik adı", "text"],
          ["tagline", "Kısa slogan", "text"],
          ["phone", "Telefon", "tel"],
          ["email", "Genel e-posta", "email"],
          ["notificationEmail", "Bildirim e-postası", "email"],
          ["address", "Adres", "text"],
          ["city", "İlçe / şehir", "text"],
        ] as const
      ).map(([key, label, type]) => (
        <FormRow key={key} id={key} label={label} required={key === "name"} error={errors[key]}>
          <Input id={key} type={type} value={values[key] ?? ""} onChange={(e) => set(key, e.target.value)} />
        </FormRow>
      ))}
      <FormRow id="workingHoursText" label="Çalışma saatleri (metin)" error={errors.workingHoursText}>
        <Input id="workingHoursText" value={values.workingHoursText ?? ""} onChange={(e) => set("workingHoursText", e.target.value)} />
      </FormRow>
      <FormRow id="mapEmbedUrl" label="Harita gömme bağlantısı" error={errors.mapEmbedUrl} description="Yalnızca Google Maps veya OpenStreetMap embed URL.">
        <Input id="mapEmbedUrl" value={values.mapEmbedUrl ?? ""} onChange={(e) => set("mapEmbedUrl", e.target.value)} />
      </FormRow>
      <FormRow id="about" label="Hakkımızda" error={errors.about}>
        <Textarea id="about" rows={6} value={values.about ?? ""} onChange={(e) => set("about", e.target.value)} />
      </FormRow>
      <FormError message={formError} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Kaydet
      </Button>
    </form>
  );
}
