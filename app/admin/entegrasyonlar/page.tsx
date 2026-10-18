import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisconnectGoogleButton, ProcessOutboxButton, RetryCalendarButton } from "@/components/admin/retry-button";
import { PageHeader } from "@/components/shared/page-header";
import { ToneBadge } from "@/components/shared/status-badge";
import { getIntegrationsOverview } from "@/features/integrations/service";
import { requirePagePermission } from "@/lib/auth/current";
import { dentistName } from "@/lib/text";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Entegrasyonlar" };

export default async function IntegrationsPage({ searchParams }: PageProps<"/admin/entegrasyonlar">) {
  const ctx = await requirePagePermission("SETTINGS_MANAGE");
  const data = await getIntegrationsOverview(ctx);
  const sp = await searchParams;
  const googleHint = typeof sp.google === "string" ? sp.google : null;

  return (
    <>
      <PageHeader
        title="Entegrasyonlar"
        description="Google Takvim, e-posta ve SMS durumunu buradan izleyin. Çalışmayan bir kanalı çalışıyormuş gibi göstermeyiz."
        actions={<ProcessOutboxButton />}
      />

      {googleHint === "not_configured" ? (
        <p className="mb-4 rounded-lg border border-[#ead7b3] bg-warning-soft px-4 py-3 text-sm text-warning-foreground">
          Google OAuth ortam değişkenleri tanımlı değil. README’deki adımları izleyin.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>E-posta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Sağlayıcı: <strong>{data.notifications.email.provider}</strong>{" "}
              {data.notifications.email.live ? <ToneBadge tone="success">Canlı</ToneBadge> : <ToneBadge tone="warning">Mock</ToneBadge>}
            </p>
            <p className="text-muted-foreground">{data.notifications.email.note}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SMS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Sağlayıcı: <strong>{data.notifications.sms.provider}</strong>{" "}
              {data.notifications.sms.live ? <ToneBadge tone="success">Canlı</ToneBadge> : <ToneBadge tone="warning">Mock</ToneBadge>}
            </p>
            <p className="text-muted-foreground">{data.notifications.sms.note}</p>
            {data.notifications.sms.testRecipient ? (
              <p className="text-xs">Geliştirmede SMS test numarasına yönlendirilir.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.googleConfigured ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href="/api/google/oauth/start">Klinik takvimini bağla</a>
              </Button>
              {data.dentists.map((d) => (
                <Button asChild key={d.id} size="sm" variant="outline">
                  <a href={`/api/google/oauth/start?dentistId=${d.id}`}>{dentistName(d)} takvimini bağla</a>
                </Button>
              ))}
            </div>
          ) : (
            <p className="flex gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              Google OAuth yapılandırılmamış (GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI). Bağlantı başlatılamaz.
            </p>
          )}

          {data.connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz bağlı takvim yok.</p>
          ) : (
            <ul className="space-y-3">
              {data.connections.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{c.googleEmail ?? "Google hesabı"}</p>
                    <p className="text-muted-foreground">
                      {c.dentist ? dentistName(c.dentist) : "Klinik takvimi"} · {c.status}
                    </p>
                    {c.lastError ? <p className="text-xs text-danger-foreground">{c.lastError}</p> : null}
                  </div>
                  <DisconnectGoogleButton id={c.id} />
                </li>
              ))}
            </ul>
          )}

          <p className="text-sm text-muted-foreground">Bekleyen senkron: {data.pendingSyncs}</p>
          {data.failedSyncs.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Başarısız senkronlar</h3>
              <ul className="space-y-2 text-sm">
                {data.failedSyncs.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <span>
                      <Link href={`/admin/randevular/${f.appointment.id}`} className="hover:underline">
                        Randevu {formatDateTime(f.appointment.startsAt)}
                      </Link>
                      {f.lastError ? <span className="block text-xs text-danger-foreground">{f.lastError}</span> : null}
                    </span>
                    <RetryCalendarButton id={f.id} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
