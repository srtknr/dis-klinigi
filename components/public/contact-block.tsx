import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { PublicClinic } from "@/features/public/queries";

export function ContactBlock({ clinic }: { clinic: PublicClinic }) {
  const items = [
    clinic.address && { icon: MapPin, label: "Adres", value: [clinic.address, clinic.city].filter(Boolean).join(", ") },
    clinic.phone && { icon: Phone, label: "Telefon", value: clinic.phone, href: `tel:${clinic.phone.replace(/\s/g, "")}` },
    clinic.email && { icon: Mail, label: "E-posta", value: clinic.email, href: `mailto:${clinic.email}` },
    clinic.workingHoursText && { icon: Clock, label: "Çalışma saatleri", value: clinic.workingHoursText },
  ].filter(Boolean) as { icon: typeof MapPin; label: string; value: string; href?: string }[];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <dl className="grid gap-4 rounded-2xl border bg-card p-6">
        {items.map((item) => (
          <div key={item.label} className="flex gap-3">
            <item.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-0.5 text-sm">
                {item.href ? (
                  <a href={item.href} className="underline-offset-4 hover:underline">
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          </div>
        ))}
        {items.length === 0 ? <p className="text-sm text-muted-foreground">İletişim bilgileri henüz eklenmedi.</p> : null}
      </dl>
      <div className="min-h-72 overflow-hidden rounded-2xl border bg-sand">
        {clinic.mapEmbedUrl ? (
          <iframe
            src={clinic.mapEmbedUrl}
            title={`${clinic.name} konum haritası`}
            className="h-full min-h-72 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full min-h-72 items-center justify-center p-6 text-sm text-muted-foreground">
            Harita bilgisi eklenmedi.
          </div>
        )}
      </div>
    </div>
  );
}
