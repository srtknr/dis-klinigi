import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarCheck,
  CalendarPlus,
  ClipboardCheck,
  HeartHandshake,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DentistCard } from "@/components/public/dentist-card";
import { ContactBlock } from "@/components/public/contact-block";
import { getPublicClinic, getPublicDentists, getPublicServices } from "@/features/public/queries";

export default async function HomePage() {
  const clinic = await getPublicClinic();
  if (!clinic) notFound();
  const [dentists, services] = await Promise.all([getPublicDentists(clinic.id), getPublicServices(clinic.id)]);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-[1.05fr_1fr] md:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-sage" aria-hidden />
            {clinic.city ?? "Ağız ve diş sağlığı"}
          </p>
          <h1 className="font-display mt-5 text-4xl leading-[1.1] tracking-tight sm:text-5xl">
            Sakin bir ortamda,
            <br />
            özenli diş bakımı.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            {clinic.tagline ??
              "Muayeneden tedavi planına kadar her adımı açıkça konuşuyor, size uygun zamanı birlikte planlıyoruz."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/randevu">
                <CalendarPlus aria-hidden /> Online Randevu Talebi
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/doktorlar">Hekimlerimizi Tanıyın</Link>
            </Button>
          </div>
          {clinic.phone ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Telefonla randevu:{" "}
              <a href={`tel:${clinic.phone.replace(/\s/g, "")}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                {clinic.phone}
              </a>
            </p>
          ) : null}
        </div>
        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border bg-sand">
            <Image
              src="/images/demo/klinik-resepsiyon.jpg"
              alt="Klinik bekleme ve karşılama alanı"
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-6 left-6 hidden rounded-2xl border bg-card px-5 py-4 sm:block">
            <p className="text-xs text-muted-foreground">Online randevu</p>
            <p className="mt-0.5 text-sm font-medium">Talebiniz klinik onayıyla kesinleşir</p>
          </div>
          {clinic.isDemo ? (
            <p className="mt-10 text-right text-xs text-muted-foreground sm:mt-9">Görseller temsilidir.</p>
          ) : null}
        </div>
      </section>

      {/* Hekimler */}
      <section aria-labelledby="hekimler" className="border-y bg-cream py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading id="hekimler" eyebrow="Ekibimiz" title="Hekimlerimiz" action={{ href: "/doktorlar", label: "Tüm hekimler" }} />
          {dentists.length === 0 ? (
            <p className="mt-8 text-muted-foreground">Hekim bilgileri yakında eklenecek.</p>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {dentists.map((d) => (
                <DentistCard key={d.id} dentist={d} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Hizmetler */}
      <section aria-labelledby="hizmetler" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading id="hizmetler" eyebrow="Tedavi alanları" title="Hizmetlerimiz" action={{ href: "/hizmetler", label: "Tüm hizmetler" }} />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.slice(0, 8).map((s) => (
            <li key={s.id} className="rounded-2xl border bg-card p-5">
              <Sparkles className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-medium">{s.name}</h3>
              {s.description ? <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{s.description}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Neden biz */}
      <section aria-labelledby="neden" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 sm:px-6 md:grid-cols-2">
        <div className="relative aspect-[5/4] overflow-hidden rounded-3xl border bg-sand">
          <Image src="/images/demo/muayene-odasi.jpg" alt="Muayene odası" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
        <div>
          <SectionHeading id="neden" eyebrow="Yaklaşımımız" title="Neden bizi tercih etmelisiniz?" />
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {[
              { icon: MessageSquareText, title: "Anlaşılır bilgilendirme", text: "Tedavi seçeneklerini, süreyi ve beklentileri sade bir dille konuşuruz." },
              { icon: ShieldCheck, title: "Hijyen ve güvenlik", text: "Sterilizasyon ve hijyen kurallarına özen gösterilen bir çalışma düzeni." },
              { icon: HeartHandshake, title: "Sakin bir ortam", text: "Diş hekimi kaygısını azaltmak için acele etmeden ilerleriz." },
              { icon: Stethoscope, title: "Planlı takip", text: "Muayene ve tedavi geçmişiniz düzenli tutulur, kontroller planlanır." },
            ].map((item) => (
              <li key={item.title}>
                <item.icon className="size-5 text-sage" aria-hidden />
                <h3 className="mt-2 font-medium">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Online randevu nasıl çalışır */}
      <section aria-labelledby="nasil" className="border-y bg-cream py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading id="nasil" eyebrow="Adım adım" title="Online randevu nasıl çalışır?" />
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: UserRoundCheck, title: "Hekim ve saat seçin", text: "Hekiminizi seçin, uygun günlerdeki boş saatleri görün." },
              { icon: ClipboardCheck, title: "Bilgilerinizi gönderin", text: "Ad, telefon ve kısa notunuzla randevu talebi oluşturun." },
              { icon: CalendarCheck, title: "Klinik onaylar", text: "Ekibimiz talebinizi kontrol eder ve onaylar ya da sizi arar." },
              { icon: MessageSquareText, title: "SMS ile bilgilendirme", text: "Onaylanan randevunun tarih ve saati size SMS ile iletilir." },
            ].map((step, i) => (
              <li key={step.title} className="rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <step.icon className="size-5 text-primary" aria-hidden />
                  <span className="font-display text-2xl text-muted-foreground/60">{i + 1}</span>
                </div>
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted-foreground">
            Gönderdiğiniz talep, klinik tarafından onaylanana kadar kesin randevu değildir. Acil durumlarda lütfen
            kliniği telefonla arayın.
          </p>
          <Button asChild className="mt-6">
            <Link href="/randevu">
              <CalendarPlus aria-hidden /> Randevu Talebi Oluştur
            </Link>
          </Button>
        </div>
      </section>

      {/* İletişim */}
      <section aria-labelledby="iletisim" className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <SectionHeading id="iletisim" eyebrow="Bize ulaşın" title="İletişim ve ulaşım" />
        <div className="mt-8">
          <ContactBlock clinic={clinic} />
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  action,
}: {
  id: string;
  eyebrow: string;
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{eyebrow}</p>
        <h2 id={id} className="font-display mt-2 text-3xl tracking-tight">
          {title}
        </h2>
      </div>
      {action ? (
        <Link href={action.href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}
