"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addPatientNoteAction } from "@/features/patients/actions";
import { handleActionResult } from "@/lib/client/action-result";

export function PatientNoteForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        startTransition(async () => {
          const result = await addPatientNoteAction({ patientId, body });
          if (handleActionResult(result)) {
            setBody("");
            router.refresh();
          }
        });
      }}
    >
      <Textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Dahili hasta notu" aria-label="Hasta notu" />
      <Button type="submit" size="sm" disabled={pending || !body.trim()}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Not ekle
      </Button>
    </form>
  );
}
