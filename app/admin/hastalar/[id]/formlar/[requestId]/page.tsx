import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ToneBadge } from "@/components/shared/status-badge";
import { getFormResult } from "@/features/forms/service";
import { requirePagePermission } from "@/lib/auth/current";
import { loadOrNotFound } from "@/lib/http/load-or-not-found";
import { fullName } from "@/lib/text";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Sağlık formu" };

export default async function PatientFormResultPage({ params }: PageProps<"/admin/hastalar/[id]/formlar/[requestId]">) {
  const ctx = await requirePagePermission("TREATMENT_VIEW");
  const { id, requestId } = await params;
  const result = await loadOrNotFound(() => getFormResult(ctx, id, requestId));
  const { request, patient, sections } = result;
  const completed = request.status === "COMPLETED";

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
          title="Bu form henüz doldurulmadı"
          description={request.status === "PENDING" ? "Hasta formu doldurduğunda sonuçlar burada görünür." : "Bu form bağlantısı artık geçerli değil."}
        />
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          {sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {section.rows.map((row) => (
                    <div key={row.id}>
                      <dt className="text-xs text-muted-foreground">{row.label}</dt>
                      <dd className={row.value === "Yanıtlanmadı" ? "text-muted-foreground" : "whitespace-pre-wrap"}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
          {request.signatureName ? (
            <p className="text-sm text-muted-foreground">
              Dijital imza: <strong className="text-foreground">{request.signatureName}</strong> · Hasta tarafından bağlantı üzerinden
              dolduruldu{request.createdByName ? `; bağlantıyı gönderen: ${request.createdByName}` : ""}.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
