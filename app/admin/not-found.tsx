import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Sayfa bulunamadı</h1>
      <p className="mt-2 text-sm text-muted-foreground">Bu kayıt silinmiş olabilir veya adresi yanlış girmiş olabilirsiniz.</p>
      <Button asChild className="mt-6">
        <Link href="/admin">Panele dön</Link>
      </Button>
    </div>
  );
}
