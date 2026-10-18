import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Clock3, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicClinic, getRequestSummary } from "@/features/public/queries";
import { dentistName } from "@/lib/text";
import { formatLongDate, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Randevu Talebiniz Alındı", robots: { index: false } };

export default async function RequestResultPage({ searchParams }: PageProps<"/randevu/sonuc">) {
  const [clinic, sp] = await Promise.all([getPublicClinic(), searchParams]);
  if (!clinic) notFound();
  const id = typeof sp.id === "string" ? sp.id : null;
  const summary = id ? await getRequestSummary(clinic.id, id) : null;

  if (!summary) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-3xl">Talep bilgisi bulunamadı</h1>
        <p className="mt-3 text-muted-foreground">
          Bu bağlantının süresi dolmuş olabilir. Randevunuzla ilgili bilgi almak için kliniği arayabilirsiniz.
        </p>
        <Button asChild className="mt-8">
          <Link href="/">Anasayfaya dön</Link>
        </Button>
      </div>
    );
  }

  const confirmed = summary.status === "CONFIRMED";
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="rounded-3xl border bg-card p-8 sm:p-10">
        <div className="flex size-12 items-center justify-center rounded-full bg-sage-soft text-sage">
          {confirmed ? <CircleCheck className="size-6" aria-hidden /> : <Clock3 className="size-6" aria-hidden />}
        </div>
        <h1 className="font-display mt-6 text-3xl tracking-tight">
          {confirmed ? "Randevunuz onaylandı" : "Randevu talebiniz alındı"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {confirmed
            ? "Randevunuz klinik tarafından onaylandı. Onay bilgisi telefonunuza SMS ile gönderilir."
            : "Talebiniz klinik ekibimize iletildi ve onay bekliyor. Randevunuz onaylandığında telefonunuza SMS ile bilgi gönderilecektir. Gerekirse sizi arayabiliriz."}
        </p>

        <dl className="mt-8 grid gap-4 rounded-2xl bg-cream p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Tarih</dt>
            <dd className="mt-0.5 font-medium">{formatLongDate(summary.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Saat</dt>
            <dd className="mt-0.5 font-medium">{formatTime(summary.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Hekim</dt>
            <dd className="mt-0.5 font-medium">{dentistName(summary.dentist)}</dd>
          </div>
          {summary.service ? (
            <div>
              <dt className="text-muted-foreground">Hizmet</dt>
              <dd className="mt-0.5 font-medium">{summary.service.name}</dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-6 text-sm text-muted-foreground">
          Bu talep onaylanana kadar kesin randevu değildir. Değişiklik veya iptal için kliniği arayabilirsiniz.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/">Anasayfaya dön</Link>
          </Button>
          {clinic.phone ? (
            <Button asChild variant="ghost">
              <a href={`tel:${clinic.phone.replace(/\s/g, "")}`}>
                <Phone aria-hidden /> {clinic.phone}
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
