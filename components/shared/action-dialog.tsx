"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/forms/form-row";
import { handleActionResult } from "@/lib/client/action-result";
import type { ActionResult } from "@/types/action";

/**
 * Onay gerektiren tek adımlı işlemler (iptal, reddet, tamamla…) için diyalog.
 * `reasonLabel` verilirse isteğe bağlı açıklama alanı gösterilir.
 */
export function ActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  reasonLabel,
  reasonHint,
  onConfirm,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  reasonLabel?: string;
  reasonHint?: string;
  onConfirm: (reason: string) => Promise<ActionResult<unknown>>;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm(reason.trim());
      if (handleActionResult(result)) {
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {reasonLabel ? (
          <div className="space-y-2">
            <Label htmlFor="action-reason">{reasonLabel}</Label>
            <Textarea id="action-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
            {reasonHint ? <p className="text-xs text-muted-foreground">{reasonHint}</p> : null}
          </div>
        ) : null}
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Vazgeç
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={confirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
