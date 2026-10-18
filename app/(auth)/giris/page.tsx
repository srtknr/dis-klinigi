import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/public/brand";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthContext } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Personel Girişi", robots: { index: false } };

export default async function LoginPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect("/admin");
  const showDemoHint = process.env.NODE_ENV !== "production";

  return (
    <main className="flex flex-1 items-center justify-center bg-cream px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <BrandMark />
          <span className="font-display text-lg">Klinik Yönetim Paneli</span>
        </Link>
        <div className="rounded-2xl border bg-card p-6 sm:p-8">
          <h1 className="text-xl font-semibold">Personel girişi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Klinik hesabınızla oturum açın.</p>
          <LoginForm />
        </div>
        {showDemoHint ? (
          <div className="mt-6 rounded-xl border border-dashed bg-background/70 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Geliştirme ortamı demo hesapları</p>
            <ul className="mt-2 space-y-1">
              <li>owner@demo-klinik.test — Klinik sahibi</li>
              <li>hekim@demo-klinik.test — Hekim</li>
              <li>editor@demo-klinik.test — Editör</li>
            </ul>
            <p className="mt-2">Şifre: seed sırasında kullanılan <code>SEED_DEMO_PASSWORD</code> değeri.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
