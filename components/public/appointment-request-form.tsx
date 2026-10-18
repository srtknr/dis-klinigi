"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError, FormRow, describedBy } from "@/components/forms/form-row";
import { DateKeyPicker } from "@/components/scheduling/date-key-picker";
import { SlotGrid, type SlotOption } from "@/components/scheduling/slot-grid";
import { submitAppointmentRequestAction } from "@/features/appointments/actions";
import { publicAppointmentSchema, type PublicAppointmentInput } from "@/lib/validations/appointment";
import { formatDateKeyLong } from "@/lib/time";
import { cn } from "@/lib/utils";

type DentistOption = { id: string; slug: string; name: string; specialty: string; weekdays: number[] };

type AvailabilityState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; slots: SlotOption[]; closedReason: string | null; externalUnavailable: boolean };

const NO_SERVICE = "__none";

export function AppointmentRequestForm({
  dentists,
  services,
  initialDentistId,
  minDateKey,
  maxDateKey,
  clinicPhone,
  hasOfflineDentists,
}: {
  dentists: DentistOption[];
  services: { id: string; name: string }[];
  initialDentistId?: string;
  minDateKey: string;
  maxDateKey: string;
  clinicPhone: string | null;
  hasOfflineDentists: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityState>({ status: "idle" });
  const requestSeq = useRef(0);

  const form = useForm<PublicAppointmentInput>({
    resolver: zodResolver(publicAppointmentSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      dentistId: initialDentistId ?? (dentists.length === 1 ? dentists[0].id : ""),
      serviceId: "",
      date: "",
      startTime: "",
      message: "",
      privacyNoticeAck: false,
      explicitConsent: false,
      website: "",
    },
  });
  const { register, control, handleSubmit, setValue, setError, formState } = form;
  const errors = formState.errors;
  const [dentistId, date, startTime, message] = useWatch({ control, name: ["dentistId", "date", "startTime", "message"] });
  const dentist = dentists.find((d) => d.id === dentistId);
  const hasMessage = (message ?? "").trim().length > 0;

  const loadSlots = useCallback(async (dId: string, dateKey: string) => {
    const seq = ++requestSeq.current;
    setAvailability({ status: "loading" });
    try {
      const res = await fetch(`/api/public/availability?dentistId=${encodeURIComponent(dId)}&date=${dateKey}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setAvailability({ status: "error", message: body.error ?? "Müsait saatler yüklenemedi." });
        return;
      }
      setAvailability({
        status: "ready",
        slots: body.slots,
        closedReason: body.closedReason,
        externalUnavailable: body.externalCalendarUnavailable,
      });
    } catch {
      if (seq !== requestSeq.current) return;
      setAvailability({ status: "error", message: "Bağlantı hatası. Lütfen tekrar deneyin." });
    }
  }, []);

  useEffect(() => {
    if (dentistId && date) void loadSlots(dentistId, date);
    else setAvailability({ status: "idle" });
  }, [dentistId, date, loadSlots]);

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await submitAppointmentRequestAction({
        ...values,
        serviceId: values.serviceId || undefined,
        email: values.email || undefined,
        message: values.message || undefined,
      });
      if (result.ok) {
        router.push(`/randevu/sonuc?id=${encodeURIComponent(result.data.appointmentId)}`);
        return;
      }
      if (result.code === "CONFLICT") {
        setValue("startTime", "");
        setError("startTime", { type: "server", message: result.error });
        if (dentistId && date) void loadSlots(dentistId, date);
      }
      if (result.fieldErrors) {
        for (const [field, msgs] of Object.entries(result.fieldErrors)) {
          if (field in values) setError(field as keyof PublicAppointmentInput, { type: "server", message: msgs[0] });
        }
      }
      setFormError(result.error);
      toast.error(result.error);
    });
  });

  if (dentists.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <p className="font-medium">Şu anda online randevu alınamıyor.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Randevu için lütfen kliniği arayın{clinicPhone ? `: ${clinicPhone}` : "."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-10" aria-busy={pending}>
      {/* 1. Hekim */}
      <fieldset className="space-y-4">
        <StepLegend step={1} title="Hekim ve hizmet" />
        <div role="radiogroup" aria-label="Hekim seçimi" className="grid gap-3 sm:grid-cols-2">
          {dentists.map((d) => {
            const checked = d.id === dentistId;
            return (
              <label
                key={d.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  checked ? "border-primary bg-secondary/60" : "hover:border-ring",
                )}
              >
                <input
                  type="radio"
                  value={d.id}
                  {...register("dentistId", {
                    onChange: () => {
                      setValue("startTime", "");
                      if (date && !d.weekdays.includes(isoWeekday(date))) setValue("date", "");
                    },
                  })}
                  className="mt-1 size-4 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-medium">{d.name}</span>
                  <span className="block text-sm text-muted-foreground">{d.specialty}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.dentistId ? <p role="alert" className="text-sm text-destructive">{errors.dentistId.message}</p> : null}
        {hasOfflineDentists ? (
          <p className="text-xs text-muted-foreground">
            Bazı hekimlerimiz için randevular yalnızca telefonla alınmaktadır.
          </p>
        ) : null}

        {services.length > 0 ? (
          <FormRow id="serviceId" label="Hizmet (isteğe bağlı)" className="max-w-md">
            <Controller
              control={control}
              name="serviceId"
              render={({ field }) => (
                <Select value={field.value || NO_SERVICE} onValueChange={(v) => field.onChange(v === NO_SERVICE ? "" : v)}>
                  <SelectTrigger id="serviceId" className="w-full">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SERVICE}>Belirtmek istemiyorum / Muayene</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormRow>
        ) : null}
      </fieldset>

      {/* 2. Tarih ve saat */}
      <fieldset className="space-y-4" disabled={!dentist}>
        <StepLegend step={2} title="Tarih ve saat" />
        {!dentist ? (
          <p className="text-sm text-muted-foreground">Önce bir hekim seçin.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <div>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <DateKeyPicker
                    value={field.value || undefined}
                    onChange={(key) => {
                      field.onChange(key ?? "");
                      setValue("startTime", "");
                    }}
                    minKey={minDateKey}
                    maxKey={maxDateKey}
                    allowedWeekdays={dentist.weekdays}
                  />
                )}
              />
              {errors.date ? <p role="alert" className="mt-2 text-sm text-destructive">{errors.date.message}</p> : null}
            </div>
            <div className="min-w-0 space-y-3">
              <p id="slot-label" className="text-sm font-medium">
                {date ? formatDateKeyLong(date) : "Takvimden bir gün seçin"}
              </p>
              {date ? (
                <SlotGrid
                  labelledBy="slot-label"
                  slots={availability.status === "ready" ? availability.slots : []}
                  value={startTime}
                  onChange={(t) => setValue("startTime", t, { shouldValidate: true })}
                  loading={availability.status === "loading"}
                  error={availability.status === "error" ? availability.message : null}
                  emptyMessage={availability.status === "ready" ? availability.closedReason : null}
                />
              ) : null}
              {errors.startTime ? <p role="alert" className="text-sm text-destructive">{errors.startTime.message}</p> : null}
              {availability.status === "ready" && availability.externalUnavailable ? (
                <p className="text-xs text-muted-foreground">
                  Hekimin harici takvimi şu anda kontrol edilemedi; seçtiğiniz saat klinik onayıyla kesinleşir.
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Saatler kliniğin bulunduğu saat dilimine (Türkiye saati) göredir.
              </p>
            </div>
          </div>
        )}
      </fieldset>

      {/* 3. Kişisel bilgiler */}
      <fieldset className="space-y-4">
        <StepLegend step={3} title="İletişim bilgileriniz" />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow id="firstName" label="Ad" required error={errors.firstName?.message}>
            <Input id="firstName" autoComplete="given-name" aria-invalid={!!errors.firstName} aria-describedby={describedBy("firstName", { error: errors.firstName?.message })} {...register("firstName")} />
          </FormRow>
          <FormRow id="lastName" label="Soyad" required error={errors.lastName?.message}>
            <Input id="lastName" autoComplete="family-name" aria-invalid={!!errors.lastName} aria-describedby={describedBy("lastName", { error: errors.lastName?.message })} {...register("lastName")} />
          </FormRow>
          <FormRow id="phone" label="Cep telefonu" required error={errors.phone?.message} description="Randevu onayı bu numaraya SMS ile gönderilir.">
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" aria-invalid={!!errors.phone} aria-describedby={describedBy("phone", { error: errors.phone?.message, description: true })} {...register("phone")} />
          </FormRow>
          <FormRow id="email" label="E-posta (isteğe bağlı)" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={describedBy("email", { error: errors.email?.message })} {...register("email")} />
          </FormRow>
        </div>
        <FormRow
          id="message"
          label="Açıklama (isteğe bağlı)"
          error={errors.message?.message}
          description="Lütfen buraya ayrıntılı sağlık bilgisi yazmayın; gerekli bilgiler muayenede hekiminizle paylaşılabilir."
        >
          <Textarea id="message" rows={3} maxLength={500} aria-invalid={!!errors.message} aria-describedby={describedBy("message", { error: errors.message?.message, description: true })} {...register("message")} />
        </FormRow>

        {/* Bot tuzağı: ekran okuyuculardan ve görsel olarak gizli */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Web sitesi</label>
          <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
        </div>
      </fieldset>

      {/* 4. KVKK */}
      <fieldset className="space-y-4">
        <StepLegend step={4} title="Onay" />
        <Controller
          control={control}
          name="privacyNoticeAck"
          render={({ field }) => (
            <ConsentRow
              id="privacyNoticeAck"
              checked={!!field.value}
              onChange={field.onChange}
              error={errors.privacyNoticeAck?.message}
            >
              <Link href="/kvkk" target="_blank" className="font-medium underline underline-offset-4">
                KVKK Aydınlatma Metni
              </Link>
              ’ni okudum; randevu talebimin değerlendirilmesi ve bana SMS / e-posta ile bilgi verilmesi amacıyla
              kişisel verilerimin işleneceğini anladım.
            </ConsentRow>
          )}
        />
        {hasMessage ? (
          <Controller
            control={control}
            name="explicitConsent"
            render={({ field }) => (
              <ConsentRow
                id="explicitConsent"
                checked={!!field.value}
                onChange={field.onChange}
                error={errors.explicitConsent?.message}
              >
                Açıklama alanına yazdığım ve sağlık bilgisi içerebilecek bilgilerin randevu talebimin değerlendirilmesi
                amacıyla işlenmesine <strong>açık rıza</strong> veriyorum.
              </ConsentRow>
            )}
          />
        ) : null}
      </fieldset>

      <FormError message={formError} />

      <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Talebiniz klinik tarafından onaylanana kadar kesin randevu değildir.
        </p>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {pending ? "Gönderiliyor…" : "Randevu Talebini Gönder"}
        </Button>
      </div>
    </form>
  );
}

function isoWeekday(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

function StepLegend({ step, title }: { step: number; title: string }) {
  return (
    <legend className="mb-1 flex items-center gap-3">
      <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-sm font-medium text-primary">{step}</span>
      <span className="font-display text-xl">{title}</span>
    </legend>
  );
}

function ConsentRow({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onChange(v === true)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5"
        />
        <label htmlFor={id} className="text-sm leading-relaxed">
          {children}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
