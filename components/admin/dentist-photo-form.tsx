"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/forms/form-row";
import { uploadDentistPhotoAction } from "@/features/dentists/actions";

export function DentistPhotoForm({ dentistId }: { dentistId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("dentistId", dentistId);
        setError(null);
        startTransition(async () => {
          const result = await uploadDentistPhotoAction(fd);
          if (result.ok) {
            toast.success(result.message ?? "Fotoğraf güncellendi.");
            router.refresh();
            return;
          }
          setError(result.error);
          toast.error(result.error);
        });
      }}
    >
      <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required className="block text-sm" />
      <p className="text-xs text-muted-foreground">JPG, PNG veya WEBP · en fazla 2 MB. Geliştirmede yerel diske kaydedilir.</p>
      <FormError message={error} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Yükle
      </Button>
    </form>
  );
}
