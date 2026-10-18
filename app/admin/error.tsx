"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-semibold">Bir sorun oluştu</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sayfa yüklenirken hata oluştu. Lütfen tekrar deneyin.</p>
      <Button className="mt-6" onClick={reset}>
        Tekrar dene
      </Button>
    </div>
  );
}
