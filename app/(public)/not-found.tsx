import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PublicNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="font-display mt-2 text-3xl">Aradığınız sayfa bulunamadı</h1>
      <p className="mt-3 text-muted-foreground">Sayfa taşınmış veya kaldırılmış olabilir.</p>
      <Button asChild className="mt-8">
        <Link href="/">Anasayfaya dön</Link>
      </Button>
    </div>
  );
}
