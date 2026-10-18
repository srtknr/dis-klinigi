import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicDentist } from "@/features/public/queries";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Button } from "@/components/ui/button";
import { dentistName, fullName } from "@/lib/text";
import { WEEKDAY_LABELS, minutesToHHMM } from "@/lib/time";

export function workingDaysSummary(hours: PublicDentist["workingHours"]): string {
  if (hours.length === 0) return "Çalışma saati tanımlı değil";
  const days = hours.map((h) => WEEKDAY_LABELS[h.weekday]?.slice(0, 3)).join(", ");
  return days;
}

export function workingHourLines(hours: PublicDentist["workingHours"]) {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const h = hours.find((x) => x.weekday === weekday);
    return {
      weekday,
      label: WEEKDAY_LABELS[weekday],
      text: h
        ? `${minutesToHHMM(h.startMinute)} – ${minutesToHHMM(h.endMinute)}${
            h.breakStartMinute != null && h.breakEndMinute != null
              ? ` (ara ${minutesToHHMM(h.breakStartMinute)}–${minutesToHHMM(h.breakEndMinute)})`
              : ""
          }`
        : "Kapalı",
      closed: !h,
    };
  });
}

export function DentistCard({ dentist }: { dentist: PublicDentist }) {
  const name = dentistName(dentist);
  return (
    <article className="flex flex-col rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-4">
        <PersonAvatar name={name} initialsOf={fullName(dentist.firstName, dentist.lastName)} photoUrl={dentist.photoUrl} size={64} />
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-tight">
            <Link href={`/doktorlar/${dentist.slug}`} className="hover:underline underline-offset-4">
              {name}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{dentist.specialty}</p>
        </div>
      </div>
      {dentist.bio ? <p className="mt-4 line-clamp-3 text-sm text-muted-foreground">{dentist.bio}</p> : null}
      <p className="mt-4 text-xs text-muted-foreground">
        Çalışma günleri: <span className="text-foreground">{workingDaysSummary(dentist.workingHours)}</span>
      </p>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {dentist.acceptsOnlineBooking ? (
          <Button asChild size="sm">
            <Link href={`/randevu?doktor=${dentist.slug}`}>Randevu Al</Link>
          </Button>
        ) : (
          <span className="inline-flex h-8 items-center rounded-lg bg-muted px-3 text-xs text-muted-foreground">
            Randevu için telefonla ulaşın
          </span>
        )}
        <Button asChild size="sm" variant="ghost">
          <Link href={`/doktorlar/${dentist.slug}`}>
            Profil <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  );
}
