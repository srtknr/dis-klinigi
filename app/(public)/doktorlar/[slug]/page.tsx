import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, ChevronLeft, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workingHourLines } from "@/components/public/dentist-card";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { getPublicClinic, getPublicDentistBySlug } from "@/features/public/queries";
import { dentistName, fullName } from "@/lib/text";

async function load(slug: string) {
  const clinic = await getPublicClinic();
  if (!clinic) return null;
  const dentist = await getPublicDentistBySlug(clinic.id, slug);
  return dentist ? { clinic, dentist } : null;
}

export async function generateMetadata({ params }: PageProps<"/doktorlar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  return { title: data ? dentistName(data.dentist) : "Hekim bulunamadı" };
}

export default async function DentistDetailPage({ params }: PageProps<"/doktorlar/[slug]">) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { clinic, dentist } = data;
  const name = dentistName(dentist);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/doktorlar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Doktorlarımız
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="flex items-center gap-5">
            <PersonAvatar name={name} initialsOf={fullName(dentist.firstName, dentist.lastName)} photoUrl={dentist.photoUrl} size={96} />
            <div>
              <h1 className="font-display text-3xl tracking-tight">{name}</h1>
              <p className="mt-1 text-muted-foreground">{dentist.specialty}</p>
            </div>
          </div>
          <div className="mt-8 space-y-4 leading-relaxed text-foreground/90">
            {(dentist.bio ?? "Hekim tanıtım bilgisi yakında eklenecek.").split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {dentist.acceptsOnlineBooking ? (
              <Button asChild size="lg">
                <Link href={`/randevu?doktor=${dentist.slug}`}>
                  <CalendarPlus aria-hidden /> Bu hekimden randevu talep et
                </Link>
              </Button>
            ) : (
              <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                Bu hekim için online randevu alınmamaktadır. Randevu için lütfen kliniği arayın.
              </p>
            )}
            {clinic.phone ? (
              <Button asChild size="lg" variant="outline">
                <a href={`tel:${clinic.phone.replace(/\s/g, "")}`}>
                  <Phone aria-hidden /> {clinic.phone}
                </a>
              </Button>
            ) : null}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border bg-card p-6">
          <h2 className="font-medium">Çalışma saatleri</h2>
          <dl className="mt-4 divide-y text-sm">
            {workingHourLines(dentist.workingHours).map((line) => (
              <div key={line.weekday} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd className={line.closed ? "text-muted-foreground" : ""}>{line.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            İzin ve resmi tatil günlerinde saatler değişebilir. Güncel uygunluk randevu sayfasında gösterilir.
          </p>
        </aside>
      </div>
    </div>
  );
}
