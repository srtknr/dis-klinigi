"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Check, CircleX, Loader2, UserRoundX, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/shared/action-dialog";
import {
  cancelAppointmentAction,
  completeAppointmentAction,
  confirmAppointmentAction,
  linkPatientAction,
  noShowAppointmentAction,
  rejectAppointmentAction,
} from "@/features/appointments/actions";
import { canTransition, type AppointmentStatusKey } from "@/features/appointments/status";
import { handleActionResult } from "@/lib/client/action-result";
import { formatPhone } from "@/lib/phone";

type Candidate = { id: string; firstName: string; lastName: string; phone: string };

export function AppointmentStatusActions({
  appointmentId,
  status,
  hasPatient,
  candidates,
  canApprove,
  canEdit,
  canManagePatient,
}: {
  appointmentId: string;
  status: AppointmentStatusKey;
  hasPatient: boolean;
  candidates: Candidate[];
  canApprove: boolean;
  canEdit: boolean;
  canManagePatient: boolean;
}) {
  const router = useRouter();
  const needsMatch = status === "PENDING" && !hasPatient && candidates.length > 0;
  const [selectedPatientId, setSelectedPatientId] = useState(candidates[0]?.id ?? "");
  const [createNew, setCreateNew] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirm = (patientId?: string, createNewPatient?: boolean) => {
    startTransition(async () => {
      const result = await confirmAppointmentAction({
        appointmentId,
        patientId,
        createNewPatient,
      });
      if (handleActionResult(result)) router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {needsMatch && canApprove ? (
        <div className="rounded-xl border border-[#ead7b3] bg-warning-soft p-4 text-sm text-warning-foreground">
          <p className="font-medium">Bu telefonla kayıtlı hasta bulundu. Onaylamadan önce eşleştirme yapın.</p>
          <ul className="mt-3 space-y-2">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="match-patient"
                    checked={!createNew && selectedPatientId === c.id}
                    onChange={() => {
                      setCreateNew(false);
                      setSelectedPatientId(c.id);
                    }}
                    className="accent-[var(--primary)]"
                  />
                  <span>
                    {c.firstName} {c.lastName}{" "}
                    <span className="text-xs opacity-80">({formatPhone(c.phone)})</span>
                  </span>
                </label>
              </li>
            ))}
            {canManagePatient ? (
              <li>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="match-patient"
                    checked={createNew}
                    onChange={() => setCreateNew(true)}
                    className="accent-[var(--primary)]"
                  />
                  <span>Farklı kişi — yeni hasta kaydı oluştur</span>
                </label>
              </li>
            ) : null}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => confirm(createNew ? undefined : selectedPatientId, createNew)}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              Seçimi onayla
            </Button>
            {canEdit && !createNew && selectedPatientId ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await linkPatientAction(appointmentId, selectedPatientId);
                    if (handleActionResult(result)) router.refresh();
                  })
                }
              >
                <UserPlus aria-hidden /> Yalnızca eşleştir
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canApprove && canTransition("confirm", status) && !needsMatch ? (
          <Button size="sm" disabled={pending} onClick={() => confirm()}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            Onayla
          </Button>
        ) : null}

        {canApprove && canTransition("reject", status) ? (
          <ActionDialog
            trigger={
              <Button size="sm" variant="outline">
                <CircleX aria-hidden /> Reddet
              </Button>
            }
            title="Talebi reddet"
            description="Hastaya SMS (ve e-posta varsa e-posta) ile bilgi gider. Saat başka taleplere açılır."
            confirmLabel="Reddet"
            destructive
            reasonLabel="Neden (isteğe bağlı, dahili)"
            onConfirm={(reason) => rejectAppointmentAction({ appointmentId, reason })}
          />
        ) : null}

        {canEdit && canTransition("cancel", status) ? (
          <ActionDialog
            trigger={
              <Button size="sm" variant="outline">
                <Ban aria-hidden /> İptal et
              </Button>
            }
            title="Randevuyu iptal et"
            description="Onaylı randevularda hastaya iptal bildirimi gönderilir."
            confirmLabel="İptal et"
            destructive
            reasonLabel="İptal nedeni (isteğe bağlı)"
            onConfirm={(reason) => cancelAppointmentAction({ appointmentId, reason })}
          />
        ) : null}

        {canEdit && canTransition("complete", status) ? (
          <ActionDialog
            trigger={
              <Button size="sm" variant="outline">
                <Check aria-hidden /> Tamamlandı
              </Button>
            }
            title="Randevuyu tamamlandı işaretle"
            description="Yalnızca bugün veya geçmiş tarihli randevular tamamlanabilir."
            confirmLabel="Tamamlandı"
            reasonLabel="Not (isteğe bağlı)"
            onConfirm={(reason) => completeAppointmentAction({ appointmentId, reason })}
          />
        ) : null}

        {canEdit && canTransition("no_show", status) ? (
          <ActionDialog
            trigger={
              <Button size="sm" variant="outline">
                <UserRoundX aria-hidden /> Gelmedi
              </Button>
            }
            title="Hastayı gelmedi olarak işaretle"
            description="Randevu saati geçtikten sonra kullanılabilir."
            confirmLabel="Gelmedi"
            destructive
            reasonLabel="Not (isteğe bağlı)"
            onConfirm={(reason) => noShowAppointmentAction({ appointmentId, reason })}
          />
        ) : null}
      </div>
      {status === "PENDING" && !canApprove ? (
        <p className="text-xs text-muted-foreground">Onay / red için yetkiniz yok.</p>
      ) : null}
    </div>
  );
}
