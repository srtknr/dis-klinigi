import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ContactBlock } from "@/components/public/contact-block";
import { PageIntro } from "@/components/public/page-intro";
import { getPublicClinic } from "@/features/public/queries";

export const metadata: Metadata = { title: "İletişim" };

export default async function ContactPage() {
  const clinic = await getPublicClinic();
  if (!clinic) notFound();
  return (
    <>
      <PageIntro
        eyebrow="Bize ulaşın"
        title="İletişim"
        description="Randevu, ulaşım ve genel sorularınız için bize telefonla veya e-posta ile ulaşabilirsiniz. Acil durumlarda lütfen telefonla arayın."
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <ContactBlock clinic={clinic} />
        {clinic.about ? (
          <div className="mt-12 grid items-center gap-8 md:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border bg-sand">
              <Image src="/images/demo/klinik-detay.jpg" alt="Klinik iç mekân detayı" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
            <div>
              <h2 className="font-display text-2xl">Kliniğimiz hakkında</h2>
              <div className="mt-4 space-y-3 text-muted-foreground">
                {clinic.about.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
