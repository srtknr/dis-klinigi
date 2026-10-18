"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addAppointmentNoteAction } from "@/features/appointments/actions";
import { handleActionResult } from "@/lib/client/action-result";

export function AppointmentNoteForm({ appointmentId }: { appointmentId: string }) {
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
          const result = await addAppointmentNoteAction({ appointmentId, body });
          if (handleActionResult(result)) {
            setBody("");
            router.refresh();
          }
        });
      }}
    >
      <Textarea
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Dahili not (hastaya gönderilmez)"
        aria-label="Dahili not"
      />
      <Button type="submit" size="sm" disabled={pending || !body.trim()}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Not ekle
      </Button>
    </form>
  );
}
