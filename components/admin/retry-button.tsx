"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  disconnectGoogleAction,
  processOutboxNowAction,
  retryCalendarSyncAction,
  retryNotificationAction,
} from "@/features/clinic/actions";
import { handleActionResult } from "@/lib/client/action-result";

export function RetryNotificationButton({ id }: { id: string }) {
  return (
    <SimpleAction label="Yeniden dene" run={() => retryNotificationAction(id)} />
  );
}

export function RetryCalendarButton({ id }: { id: string }) {
  return <SimpleAction label="Yeniden dene" run={() => retryCalendarSyncAction(id)} />;
}

export function DisconnectGoogleButton({ id }: { id: string }) {
  return <SimpleAction label="Bağlantıyı kes" variant="outline" run={() => disconnectGoogleAction(id)} />;
}

export function ProcessOutboxButton() {
  return <SimpleAction label="Kuyruğu şimdi işle" run={() => processOutboxNowAction()} />;
}

function SimpleAction({
  label,
  run,
  variant = "outline",
}: {
  label: string;
  run: () => Promise<{ ok: boolean; error?: string; message?: string }>;
  variant?: "outline" | "default";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await run();
          if (handleActionResult(result as never)) router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}
