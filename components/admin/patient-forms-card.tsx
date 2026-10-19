"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ClipboardList, Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneBadge, type Tone } from "@/components/shared/status-badge";
import { cancelFormRequestAction, createFormRequestAction } from "@/features/forms/actions";
import type { FormDisplayStatus } from "@/features/forms/service";
import { FORM_LINK_VALID_DAYS } from "@/lib/forms/anamnesis";

export type FormListItem = {
  id: string;
  displayStatus: FormDisplayStatus;
  createdAt: string;
  completedAt: string | null;
  createdByName: string | null;
};

const STATUS: Record<FormDisplayStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Hasta bekleniyor", tone: "warning" },
  COMPLETED: { label: "Dolduruldu", tone: "success" },
  EXPIRED: { label: "Süresi doldu", tone: "muted" },
  CANCELLED: { label: "İptal edildi", tone: "muted" },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" });
}

export function PatientFormsCard({
  patientId,
  items,
  canManage,
  canSms,
  canEmail,
}: {
  patientId: string;
  items: FormListItem[];
  canManage: boolean;
  canSms: boolean;
  canEmail: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Sağlık formları</CardTitle>
        {canManage ? <SendFormDialog patientId={patientId} canSms={canSms} canEmail={canEmail} /> : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu hastaya henüz sağlık formu gönderilmedi.</p>
        ) : (
          <ul className="divide-y">
            {items.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    <ClipboardList className="size-4 text-muted-foreground" aria-hidden /> Sağlık geçmişi (anamnez)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.completedAt ? `Dolduruldu: ${formatDateTime(f.completedAt)}` : `Gönderildi: ${formatDateTime(f.createdAt)}`}
                    {f.createdByName ? ` · ${f.createdByName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ToneBadge tone={STATUS[f.displayStatus].tone}>{STATUS[f.displayStatus].label}</ToneBadge>
                  {f.displayStatus === "COMPLETED" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/hastalar/${patientId}/formlar/${f.id}`}>Görüntüle</Link>
                    </Button>
                  ) : null}
                  {f.displayStatus === "PENDING" && canManage ? <CancelButton id={f.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CancelButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await cancelFormRequestAction(id);
          if (r.ok) {
            toast.success(r.message);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      İptal et
    </Button>
  );
}

function SendFormDialog({ patientId, canSms, canEmail }: { patientId: string; canSms: boolean; canEmail: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sms, setSms] = useState(canSms);
  const [email, setEmail] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setLink(null);
    setCopied(false);
    setError(null);
    setSms(canSms);
    setEmail(false);
  };

  const create = () => {
    setError(null);
    startTransition(async () => {
      const r = await createFormRequestAction({ patientId, sendSms: sms, sendEmail: email });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLink(r.data.link);
      router.refresh();
    });
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Bağlantı kopyalandı.");
    } catch {
      toast.error("Kopyalanamadı; bağlantıyı elle seçip kopyalayın.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Send aria-hidden /> Form gönder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sağlık formu gönder</DialogTitle>
          <DialogDescription>
            Hastaya kişiye özel bir bağlantı oluşturulur ({FORM_LINK_VALID_DAYS} gün geçerli, tek kullanımlık). Hasta formu doldurunca
            size bildirim düşer. Bu hastaya gönderilmiş bekleyen önceki bağlantılar iptal edilir.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Bağlantı hazır.</p>
            <div className="flex items-center gap-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Form bağlantısı" className="min-w-0 flex-1 rounded-lg border bg-muted/40 px-3 py-2 text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={copy}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />} Kopyala
              </Button>
            </div>
            <p className="text-muted-foreground">
              {sms || email ? `Bağlantı ${[sms && "SMS", email && "e-posta"].filter(Boolean).join(" ve ")} ile de gönderiliyor. ` : ""}
              Bu bağlantıyı yalnızca bu pencerede görebilirsiniz; WhatsApp&apos;tan elle de iletebilirsiniz.
            </p>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Kapat
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <label className="flex items-center gap-3">
              <Checkbox checked={sms} onCheckedChange={(v) => setSms(v === true)} disabled={!canSms} />
              SMS ile gönder {!canSms ? <span className="text-muted-foreground">(kayıtlı cep telefonu yok)</span> : null}
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={email} onCheckedChange={(v) => setEmail(v === true)} disabled={!canEmail} />
              E-posta ile gönder {!canEmail ? <span className="text-muted-foreground">(kayıtlı e-posta yok)</span> : null}
            </label>
            <p className="text-muted-foreground">Hiçbirini seçmezseniz yalnızca bağlantı üretilir; kopyalayıp kendiniz iletebilirsiniz.</p>
            {error ? (
              <p role="alert" className="rounded-lg border border-[#ecc9bd] bg-danger-soft px-3 py-2 text-danger-foreground">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" onClick={create} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Bağlantı oluştur
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
