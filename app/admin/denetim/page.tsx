import type { Metadata } from "next";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { listAuditLogs } from "@/features/integrations/service";
import { AUDIT_ACTION_LABELS } from "@/lib/audit";
import { requirePagePermission } from "@/lib/auth/current";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Denetim kayıtları" };

const ENTITIES = ["Appointment", "Patient", "TreatmentRecord", "DentistProfile", "Membership", "Clinic", "User", "GoogleCalendarConnection", "NotificationLog"];

export default async function AuditPage({ searchParams }: PageProps<"/admin/denetim">) {
  const ctx = await requirePagePermission("AUDIT_VIEW");
  const sp = await searchParams;
  const entityType = typeof sp.entityType === "string" ? sp.entityType : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;
  const result = await listAuditLogs(ctx, { entityType, page: Number.isFinite(page) ? page : 1 });

  return (
    <>
      <PageHeader title="Denetim kayıtları" description="Klinik not içerikleri burada tutulmaz." />
      <form method="get" className="mb-4 flex gap-2">
        <NativeSelect name="entityType" defaultValue={entityType ?? ""} aria-label="Varlık">
          <option value="">Tüm kayıtlar</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">Filtrele</Button>
      </form>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {result.items.map((row) => (
          <li key={row.id} className="px-4 py-3 text-sm">
            <p className="font-medium">{AUDIT_ACTION_LABELS[row.action] ?? row.action}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(row.createdAt)} · {row.actor?.name ?? "sistem"} · {row.entityType}
              {row.entityId ? ` · ${row.entityId.slice(0, 8)}…` : ""}
            </p>
          </li>
        ))}
      </ul>
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        basePath="/admin/denetim"
        params={{ entityType }}
      />
    </>
  );
}
