"use client";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

/**
 * Etiket + kontrol + açıklama + hata mesajı düzeni. Kontrol, `htmlFor` ile aynı id'yi ve
 * `aria-describedby={describedBy(id)}` değerini kullanmalıdır.
 */
export function FormRow({
  id,
  label,
  error,
  description,
  required,
  children,
  className,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
  description?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </FieldLabel>
      {children}
      {description ? <FieldDescription id={`${id}-desc`}>{description}</FieldDescription> : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

export function describedBy(id: string, opts: { error?: string; description?: boolean } = {}) {
  return [opts.description ? `${id}-desc` : null, opts.error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-[#ecc9bd] bg-danger-soft px-4 py-3 text-sm text-danger-foreground">
      {message}
    </div>
  );
}
