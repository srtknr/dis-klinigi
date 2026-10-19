"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormRow } from "@/components/forms/form-row";
import { submitPatientFormAction } from "@/features/forms/actions";
import { ANAMNESIS_FORM } from "@/lib/forms/anamnesis";
import type { FormAnswers, FormField } from "@/lib/forms/types";
import { isFieldVisible, validateStep, withClinicName, type FormErrors } from "@/lib/forms/validate";
import { cn } from "@/lib/utils";

const optionCard =
  "flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5";

export function AnamnesisForm({ token, clinicName, prefill }: { token: string; clinicName: string; prefill: FormAnswers }) {
  const steps = ANAMNESIS_FORM.steps;
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<FormAnswers>(prefill);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const setValue = (id: string, value: FormAnswers[string]) => {
    setAnswers((s) => ({ ...s, [id]: value }));
    setErrors((e) => {
      if (!e[id]) return e;
      const rest = { ...e };
      delete rest[id];
      return rest;
    });
  };

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const goTo = (index: number) => {
    setStepIndex(index);
    setFormError(null);
    requestAnimationFrame(scrollTop);
  };

  const next = () => {
    const { errors: stepErrors } = validateStep(step, answers);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setFormError("Lütfen işaretli alanları doldurun.");
      requestAnimationFrame(() => document.getElementById(Object.keys(stepErrors)[0])?.scrollIntoView({ block: "center" }));
      return;
    }
    setErrors({});
    goTo(stepIndex + 1);
  };

  const submit = () => {
    const { errors: stepErrors } = validateStep(step, answers);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setFormError("Lütfen işaretli alanları doldurun.");
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const result = await submitPatientFormAction(token, answers);
      if (result.ok) {
        setDone(true);
        requestAnimationFrame(scrollTop);
        return;
      }
      if (result.fieldErrors) {
        const fe: FormErrors = {};
        for (const [k, v] of Object.entries(result.fieldErrors)) fe[k] = v[0];
        setErrors(fe);
        // Hatalı alanın bulunduğu ilk adıma dön
        const failing = steps.findIndex((s) => s.fields.some((f) => fe[f.id]));
        if (failing >= 0) setStepIndex(failing);
      }
      setFormError(result.error);
      toast.error(result.error);
    });
  };

  if (done) {
    return (
      <div ref={topRef} className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        <CircleCheck className="mx-auto size-12 text-primary" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold">Teşekkür ederiz</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Formunuz başarıyla gönderildi. Hekiminiz bilgilerinizi inceleyecektir. Bu sayfayı kapatabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
      <div className="mb-6">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={stepIndex + 1}
          aria-label="Form ilerlemesi"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {stepIndex + 1} / {steps.length}
        </p>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (isLast) submit();
          else next();
        }}
      >
        <h2 className="mb-5 border-b pb-3 font-display text-xl">{step.title}</h2>

        {step.id === "onay" ? (
          <p className="mb-4 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            Verileriniz nasıl işlenir? Ayrıntılar için{" "}
            <Link href="/kvkk" target="_blank" rel="noopener" className="font-medium text-foreground underline">
              KVKK Aydınlatma Metni
            </Link>
            &apos;ni okuyabilirsiniz.
          </p>
        ) : null}

        <div className="space-y-5">
          {step.fields
            .filter((f) => isFieldVisible(f, answers))
            .map((field) => (
              <FieldInput key={field.id} field={field} clinicName={clinicName} value={answers[field.id]} error={errors[field.id]} onChange={(v) => setValue(field.id, v)} />
            ))}
        </div>

        {isLast ? (
          <p className="mt-5 text-sm text-muted-foreground">
            Tarih: <strong className="text-foreground">{new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}</strong>
          </p>
        ) : null}

        {formError ? (
          <p role="alert" className="mt-5 rounded-lg border border-[#ecc9bd] bg-danger-soft px-3 py-2 text-sm text-danger-foreground">
            {formError}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3 border-t pt-5">
          {stepIndex > 0 ? (
            <Button type="button" variant="outline" onClick={() => goTo(stepIndex - 1)} disabled={pending}>
              Önceki
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isLast ? "Gönder" : "Sonraki"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FieldInput({
  field,
  clinicName,
  value,
  error,
  onChange,
}: {
  field: FormField;
  clinicName: string;
  value: FormAnswers[string] | undefined;
  error?: string;
  onChange: (value: FormAnswers[string]) => void;
}) {
  const label = withClinicName(field.label, clinicName);
  const id = field.id;

  if (field.type === "consent") {
    return (
      <div>
        <label htmlFor={id} className={cn(optionCard, "items-start", error && "border-destructive")}>
          <Checkbox id={id} checked={value === true} onCheckedChange={(v) => onChange(v === true)} aria-invalid={error ? true : undefined} className="mt-0.5" />
          <span>
            {label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </span>
        </label>
        {error ? (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <FormRow id={id} label={label} required={field.required} error={error}>
      {field.type === "text" || field.type === "email" || field.type === "tel" ? (
        <Input
          id={id}
          type={field.type}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          rows={4}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "number" ? (
        <Input
          id={id}
          inputMode="decimal"
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "date" ? (
        <Input
          id={id}
          type="date"
          value={typeof value === "string" ? value : ""}
          max={field.kind === "birth" ? new Date().toISOString().slice(0, 10) : undefined}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "radio" ? (
        <div id={id} role="radiogroup" aria-invalid={error ? true : undefined} className="grid gap-2 sm:grid-cols-2">
          {field.options.map((o) => (
            <label key={o.value} className={cn(optionCard, error && "border-destructive/60")}>
              <input
                type="radio"
                name={id}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="size-4 accent-[var(--primary)]"
              />
              {o.label}
            </label>
          ))}
        </div>
      ) : field.type === "checkbox" ? (
        <div id={id} role="group" className="grid gap-2 sm:grid-cols-2">
          {field.options.map((o) => {
            const selected = Array.isArray(value) ? value : [];
            const checked = selected.includes(o.value);
            return (
              <label key={o.value} className={cn(optionCard, error && "border-destructive/60")}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    if (v !== true) return onChange(selected.filter((x) => x !== o.value));
                    // "Hiçbiri" gibi özel seçenek diğerlerini temizler, diğerleri özel seçeneği kaldırır
                    const exclusiveValues = field.options.filter((x) => x.exclusive).map((x) => x.value);
                    onChange(o.exclusive ? [o.value] : [...selected.filter((x) => !exclusiveValues.includes(x)), o.value]);
                  }}
                />
                {o.label}
              </label>
            );
          })}
        </div>
      ) : null}
    </FormRow>
  );
}
