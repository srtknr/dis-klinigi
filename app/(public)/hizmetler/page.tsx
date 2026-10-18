import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/public/page-intro";
import { EmptyState } from "@/components/shared/empty-state";
import { getPublicClinic, getPublicServices } from "@/features/public/queries";

export const metadata: Metadata = { title: "Hizmetlerimiz" };

export default async function ServicesPage() {
  const clinic = await getPublicClinic();
  if (!clinic) notFound();
  const services = await getPublicServices(clinic.id);
  return (
    <>
      <PageIntro
        eyebrow="Tedavi alanları"
        title="Hizmetlerimiz"
        description="Aşağıdaki açıklamalar genel bilgilendirme amaçlıdır. Size uygun tedavi, muayene sonrasında hekiminizle birlikte planlanır."
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {services.length === 0 ? (
          <EmptyState icon={Sparkles} title="Hizmet bilgisi henüz eklenmedi" />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <li key={s.id} className="flex flex-col rounded-2xl border bg-card p-6">
                <Sparkles className="size-5 text-primary" aria-hidden />
                <h2 className="mt-3 text-lg font-medium">{s.name}</h2>
                {s.description ? <p className="mt-2 text-sm text-muted-foreground">{s.description}</p> : null}
                {s.durationMinutes ? (
                  <p className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden /> Ortalama seans: {s.durationMinutes} dk
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-10 rounded-2xl border bg-cream p-6 sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Hangi tedaviye ihtiyacınız olduğundan emin değil misiniz?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Muayene randevusu oluşturun; hekiminiz sizinle birlikte değerlendirsin.</p>
          </div>
          <Button asChild className="mt-4 sm:mt-0">
            <Link href="/randevu">Randevu Talebi Oluştur</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
