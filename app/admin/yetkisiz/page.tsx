import type { Metadata } from "next";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requirePageAuth } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Yetkisiz" };

export default async function UnauthorizedPage() {
  await requirePageAuth();
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <ShieldOff className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold">Bu sayfaya erişim yetkiniz yok</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Hesabınıza bu işlem için izin tanımlanmamış. Gerekirse klinik sahibiyle iletişime geçin.
      </p>
      <Button asChild className="mt-6">
        <Link href="/admin">Panele dön</Link>
      </Button>
    </div>
  );
}
