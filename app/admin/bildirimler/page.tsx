import type { Metadata } from "next";
import Link from "next/link";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { ProcessOutboxButton, RetryNotificationButton } from "@/components/admin/retry-button";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ToneBadge } from "@/components/shared/status-badge";
import { listNotifications } from "@/features/integrations/service";
import { requirePagePermission } from "@/lib/auth/current";
import { maskEmail, maskPhone, normalizeTrPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Bildirim kayıtları" };

const STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" | "muted" | "info" }> = {
  PENDING: { label: "Kuyrukta", tone: "warning" },
  PROCESSING: { label: "İşleniyor", tone: "info" },
  SENT: { label: "Gönderildi", tone: "success" },
  FAILED: { label: "Başarısız", tone: "danger" },
  SKIPPED: { label: "Atlandı", tone: "muted" },
};
const TEMPLATE: Record<string, string> = {
  PATIENT_CONFIRMED: "Onay",
  PATIENT_REJECTED: "Red",
  PATIENT_CANCELLED: "İptal",
  PATIENT_RESCHEDULED: "Yeniden planlama",
  PATIENT_REMINDER_24H: "24 saat hatırlatma",
  ADMIN_NEW_REQUEST: "Yeni talep",
};

function maskRecipient(value: string, channel: string) {
  if (channel === "EMAIL") return maskEmail(value);
  const phone = normalizeTrPhone(value) ?? (value.startsWith("90") ? `+${value}` : value);
  return maskPhone(phone);
}

export default async function NotificationsPage({ searchParams }: PageProps<"/admin/bildirimler">) {
  const ctx = await requirePagePermission("SETTINGS_MANAGE");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;
  const result = await listNotifications(ctx, { status, page: Number.isFinite(page) ? page : 1 });

  return (
    <>
      <PageHeader title="Bildirim kayıtları" actions={<ProcessOutboxButton />} />
      <form method="get" className="mb-4 flex gap-2">
        <NativeSelect name="status" defaultValue={status ?? ""} aria-label="Durum">
          <option value="">Tümü</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">Filtrele</Button>
      </form>
      {result.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kayıt yok.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {result.items.map((n) => {
            const s = STATUS[n.status] ?? { label: n.status, tone: "muted" as const };
            return (
              <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p>
                    {n.channel} · {TEMPLATE[n.template] ?? n.template} · {maskRecipient(n.recipient, n.channel)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(n.createdAt)} · {n.provider ?? "—"}
                    {n.appointmentId ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/admin/randevular/${n.appointmentId}`} className="hover:underline">
                          randevu
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {n.lastError ? <p className="text-xs text-danger-foreground">{n.lastError}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <ToneBadge tone={s.tone}>{s.label}</ToneBadge>
                  {n.status === "FAILED" || n.status === "PENDING" ? <RetryNotificationButton id={n.id} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} total={result.total} basePath="/admin/bildirimler" params={{ status }} />
    </>
  );
}
