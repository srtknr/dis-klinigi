import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { PublicClinic } from "@/features/public/queries";
import { BrandMark } from "@/components/public/brand";

export function SiteFooter({ clinic }: { clinic: PublicClinic }) {
  return (
    <footer className="mt-24 border-t bg-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg">{clinic.name}</span>
          </div>
          {clinic.tagline ? <p className="mt-4 max-w-sm text-sm text-muted-foreground">{clinic.tagline}</p> : null}
          {clinic.isDemo ? (
            <p className="mt-4 max-w-sm rounded-lg border border-dashed border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              Bu site bir demo uygulamasıdır. Klinik, hekim ve iletişim bilgileri örnek amaçlıdır ve gerçek bir sağlık
              kuruluşunu temsil etmez.
            </p>
          ) : null}
        </div>

        <div>
          <h2 className="text-sm font-semibold">İletişim</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {clinic.address ? (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {clinic.address}
                  {clinic.city ? <><br />{clinic.city}</> : null}
                </span>
              </li>
            ) : null}
            {clinic.phone ? (
              <li className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a href={`tel:${clinic.phone.replace(/\s/g, "")}`} className="hover:text-foreground">{clinic.phone}</a>
              </li>
            ) : null}
            {clinic.email ? (
              <li className="flex gap-2">
                <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a href={`mailto:${clinic.email}`} className="hover:text-foreground">{clinic.email}</a>
              </li>
            ) : null}
            {clinic.workingHoursText ? (
              <li className="flex gap-2">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{clinic.workingHoursText}</span>
              </li>
            ) : null}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Bilgilendirme</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/kvkk" className="hover:text-foreground">KVKK Aydınlatma Metni</Link></li>
            <li><Link href="/gizlilik" className="hover:text-foreground">Gizlilik ve Çerez Politikası</Link></li>
            <li><Link href="/randevu" className="hover:text-foreground">Online Randevu</Link></li>
            <li><Link href="/giris" className="hover:text-foreground">Personel Girişi</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {clinic.name}. Web sitesindeki bilgiler genel bilgilendirme amaçlıdır; tanı ve
          tedavi için hekiminize başvurunuz.
        </p>
      </div>
    </footer>
  );
}
