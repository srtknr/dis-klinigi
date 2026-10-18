"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { upsertServiceAction } from "@/features/clinic/actions";

type Row = {
  id?: string;
  name: string;
  description: string;
  durationMinutes?: number;
  isActive: boolean;
  sortOrder: number;
};

export function ServiceListForm({ services }: { services: Row[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Row>({ name: "", description: "", isActive: true, sortOrder: services.length });

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="font-medium">Hizmetler</h2>
      <ul className="space-y-3">
        {services.map((s) => (
          <li key={s.id}>
            <ServiceRow row={s} onSaved={() => router.refresh()} />
          </li>
        ))}
      </ul>
      <div className="border-t pt-4">
        <p className="mb-2 text-sm font-medium">Yeni hizmet</p>
        <ServiceRow
          row={draft}
          onChange={setDraft}
          onSaved={() => {
            setDraft({ name: "", description: "", isActive: true, sortOrder: services.length + 1 });
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}

function ServiceRow({ row, onChange, onSaved }: { row: Row; onChange?: (r: Row) => void; onSaved: () => void }) {
  const [local, setLocal] = useState(row);
  const [pending, startTransition] = useTransition();
  const current = onChange ? row : local;
  const set = (next: Row) => (onChange ? onChange(next) : setLocal(next));

  return (
    <form
      className="grid gap-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await upsertServiceAction({
            serviceId: current.id,
            name: current.name,
            description: current.description || undefined,
            durationMinutes: current.durationMinutes,
            isActive: current.isActive,
            sortOrder: current.sortOrder,
          });
          if (result.ok) {
            toast.success(result.message);
            onSaved();
          } else toast.error(result.error);
        });
      }}
    >
      <Input value={current.name} onChange={(e) => set({ ...current, name: e.target.value })} placeholder="Hizmet adı" required />
      <Textarea rows={2} value={current.description} onChange={(e) => set({ ...current, description: e.target.value })} placeholder="Açıklama" />
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="number"
          className="w-28"
          min={10}
          placeholder="dk"
          value={current.durationMinutes ?? ""}
          onChange={(e) => set({ ...current, durationMinutes: e.target.value ? Number(e.target.value) : undefined })}
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={current.isActive} onCheckedChange={(v) => set({ ...current, isActive: v === true })} />
          Aktif
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Kaydet
        </Button>
      </div>
    </form>
  );
}
