import type { Metadata } from "next";
import { CircleCheck, ClipboardList, Download, HeartPulse, type LucideIcon, Moon, PenLine, Smile, TriangleAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ToneBadge } from "@/components/shared/status-badge";
import { getFormResult } from "@/features/forms/service";
import { requirePagePermission } from "@/lib/auth/current";
import type { AnswerRow, AnswerSection } from "@/lib/forms/validate";
import { loadOrNotFound } from "@/lib/http/load-or-not-found";
import { fullName } from "@/lib/text";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sağlık formu" };

const SECTION_ICONS: Record<string, LucideIcon> = {
  genel: UserRound,
  tibbi: HeartPulse,
  dis: Smile,
  yasam: Moon,
  onay: PenLine,
};

const UNANSWERED = "Yanıtlanmadı";
/** Bu uzunluğun üstündeki cevaplar iki sütunu da kaplar (uzun metin ve seçim listeleri) */
const WIDE_ANSWER_LENGTH = 44;

type Alert = { label: string; value: string };

/** Hekimin ilk bakışta görmesi gereken klinik uyarılar: alerji, ilaç, sistemik hastalık. */
function clinicalAlerts(sections: AnswerSection[]): Alert[] {
  const rows = new Map<string, AnswerRow>(sections.flatMap((s) => s.rows).map((r) => [r.id, r]));
  const get = (id: string) => rows.get(id)?.value;
  const alerts: Alert[] = [];

  if (get("alerji") === "Evet") alerts.push({ label: "Alerji", value: get("alerjiDetay") && get("alerjiDetay") !== UNANSWERED ? get("alerjiDetay")! : "Var (tür belirtilmemiş)" });
  const meds = get("ilaclar");
  if (meds && meds !== UNANSWERED && meds !== "İlaç kullanmıyorum") {
    const other = get("ilaclarDiger");
    alerts.push({ label: "Kullandığı ilaçlar", value: other && other !== UNANSWERED ? `${meds.replace("Diğer", other)}` : meds });
  }
  const conditions = get("hastaliklar");
  if (conditions && conditions !== UNANSWERED && conditions !== "Hiçbiri") {
    const other = get("hastaliklarDiger");
    alerts.push({ label: "Sistemik hastalıklar", value: other && other !== UNANSWERED ? conditions.replace("Diğer", other) : conditions });
  }
  const surgery = get("ameliyat");
  if (surgery && surgery !== UNANSWERED) alerts.push({ label: "Ameliyat / yatış geçmişi", value: surgery });
  return alerts;
}

export default async function PatientFormResultPage({ params }: PageProps<"/admin/hastalar/[id]/formlar/[requestId]">) {
  const ctx = await requirePagePermission("TREATMENT_VIEW");
  const { id, requestId } = await params;
  const result = await loadOrNotFound(() => getFormResult(ctx, id, requestId));
  const { request, patient, sections } = result;
  const completed = request.status === "COMPLETED";
  const alerts = completed ? clinicalAlerts(sections) : [];
  // Onay bölümü sayfanın altında ayrı gösterilir
  const contentSections = sections.filter((s) => s.id !== "onay");
  const consent = sections.find((s) => s.id === "onay");

  return (
    <>
      <PageHeader
        title={result.title}
        back={{ href: `/admin/hastalar/${id}`, label: fullName(patient.firstName, patient.lastName) }}
        description={
          completed && request.completedAt ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <ToneBadge tone="success">Dolduruldu</ToneBadge>
              {formatDateTime(request.completedAt)}
            </span>
          ) : undefined
        }
        actions={
          completed ? (
            <Button asChild>
              <a href={`/admin/hastalar/${id}/formlar/${requestId}/pdf`} download>
                <Download aria-hidden /> PDF indir
              </a>
            </Button>
          ) : null
        }
      />

      {!completed ? (
        <EmptyState
          icon={ClipboardList}
          title="Bu form henüz doldurulmadı"
          description={request.status === "PENDING" ? "Hasta formu doldurduğunda sonuçlar burada görünür." : "Bu form bağlantısı artık geçerli değil."}
        />
      ) : (
        <div className="space-y-6">
          {alerts.length > 0 ? (
            <section aria-label="Klinik uyarılar" className="rounded-2xl border border-[#ead7b3] bg-warning-soft p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-warning-foreground">
                <TriangleAlert className="size-4" aria-hidden /> Dikkat edilmesi gerekenler
              </h2>
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                {alerts.map((a) => (
                  <div key={a.label} className="min-w-0">
                    <dt className="text-xs text-warning-foreground/80">{a.label}</dt>
                    <dd className="text-sm font-medium break-words text-foreground">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            <p className="flex items-center gap-2 rounded-2xl border border-[#cfdac7] bg-sage-soft px-5 py-3 text-sm text-[#3f5238]">
              <CircleCheck className="size-4 shrink-0" aria-hidden /> Alerji, düzenli ilaç, sistemik hastalık veya ameliyat geçmişi bildirilmemiş.
            </p>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-2">
            {contentSections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenLine className="size-4 text-muted-foreground" aria-hidden /> Onay ve dijital imza
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 text-sm md:grid-cols-2">
              <ul className="space-y-2">
                {consent?.rows
                  .filter((r) => r.value === "Onaylandı" || r.value === "Onaylanmadı")
                  .map((r) => (
                    <li key={r.id} className="flex items-start gap-2">
                      <CircleCheck className={cn("mt-0.5 size-4 shrink-0", r.value === "Onaylandı" ? "text-[#3f5238]" : "text-muted-foreground")} aria-hidden />
                      <span>{r.label}</span>
                    </li>
                  ))}
              </ul>
              <div className="space-y-1 rounded-xl bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Dijital imza</p>
                <p className="font-display text-xl">{request.signatureName ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {request.completedAt ? formatDateTime(request.completedAt) : null}
                  {request.createdByName ? ` · Bağlantıyı gönderen: ${request.createdByName}` : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function SectionCard({ section }: { section: AnswerSection }) {
  const Icon = SECTION_ICONS[section.id] ?? ClipboardList;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
          {section.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          {section.rows.map((row) => {
            const empty = row.value === UNANSWERED;
            return (
              <div key={row.id} className={cn("min-w-0", !empty && row.value.length > WIDE_ANSWER_LENGTH && "sm:col-span-2")}>
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className={cn("mt-0.5 break-words whitespace-pre-wrap", empty ? "text-muted-foreground/70" : "font-medium")}>{row.value}</dd>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
