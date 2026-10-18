"use client";

import { Button } from "@/components/ui/button";

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-3xl">Bir sorun oluştu</h1>
      <p className="mt-3 text-muted-foreground">Sayfa şu anda yüklenemedi. Lütfen biraz sonra tekrar deneyin.</p>
      <Button className="mt-8" onClick={reset}>
        Tekrar dene
      </Button>
    </div>
  );
}
