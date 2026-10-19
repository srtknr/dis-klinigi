"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormError, FormRow } from "@/components/forms/form-row";
import { saveWhatsappConfigAction } from "@/features/whatsapp/actions";

type Initial = {
  phoneNumberId: string;
  wabaId: string;
  templateName: string;
  templateLanguage: string;
  isEnabled: boolean;
  hasToken: boolean;
};

export function WhatsappConfigForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [accessToken, setAccessToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: "phoneNumberId" | "wabaId" | "templateName" | "templateLanguage", v: string) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        setErrors({});
        startTransition(async () => {
          const result = await saveWhatsappConfigAction({
            phoneNumberId: values.phoneNumberId,
            wabaId: values.wabaId,
            templateName: values.templateName,
            templateLanguage: values.templateLanguage,
            isEnabled: values.isEnabled,
            accessToken,
          });
          if (result.ok) {
            toast.success(result.message);
            setAccessToken("");
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
        <FormRow id="wa-phone" label="Telefon numarası kimliği" required error={errors.phoneNumberId} description='Meta panelinde "Phone number ID".'>
          <Input id="wa-phone" inputMode="numeric" value={values.phoneNumberId} onChange={(e) => set("phoneNumberId", e.target.value)} />
        </FormRow>
        <FormRow id="wa-waba" label="WhatsApp Business hesap kimliği" error={errors.wabaId} description="İsteğe bağlı (WABA ID).">
          <Input id="wa-waba" inputMode="numeric" value={values.wabaId} onChange={(e) => set("wabaId", e.target.value)} />
        </FormRow>
      </div>
      <FormRow
        id="wa-token"
        label="Kalıcı erişim token'ı"
        required={!initial.hasToken}
        error={errors.accessToken}
        description={initial.hasToken ? "Kayıtlı bir token var. Değiştirmek istemiyorsanız boş bırakın. Token şifreli saklanır ve bir daha gösterilmez." : "Token şifreli saklanır ve bir daha gösterilmez."}
      >
        <Input id="wa-token" type="password" autoComplete="off" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
      </FormRow>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow id="wa-template" label="Onaylı şablon adı" required error={errors.templateName}>
          <Input id="wa-template" value={values.templateName} onChange={(e) => set("templateName", e.target.value)} placeholder="randevu_hatirlatma" />
        </FormRow>
        <FormRow id="wa-lang" label="Şablon dili" required error={errors.templateLanguage}>
          <Input id="wa-lang" value={values.templateLanguage} onChange={(e) => set("templateLanguage", e.target.value)} placeholder="tr" />
        </FormRow>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={values.isEnabled} onCheckedChange={(v) => setValues((s) => ({ ...s, isEnabled: v }))} />
        Randevudan 24 saat önce WhatsApp hatırlatması gönder
      </label>
      <FormError message={formError} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Kaydet
      </Button>
    </form>
  );
}
