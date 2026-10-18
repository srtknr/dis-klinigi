"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchPatientsAction } from "@/features/appointments/actions";
import { formatPhone } from "@/lib/phone";

export type PickedPatient = { id: string; name: string; phone: string };

export function PatientPicker({
  value,
  onChange,
  id,
  invalid,
}: {
  value: PickedPatient | null;
  onChange: (p: PickedPatient | null) => void;
  id?: string;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchPatientsAction(term);
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setResults(result.data);
        setError(null);
      } else setError(result.error);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/50 px-4 py-3">
        <div>
          <p className="font-medium">{value.name}</p>
          <p className="text-sm text-muted-foreground">{formatPhone(value.phone)}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          <X aria-hidden /> Değiştir
        </Button>
      </div>
    );
  }

  const visible = term.length >= 2 ? results : [];
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ad, soyad veya telefon ile arayın"
          className="pl-9"
          aria-invalid={invalid}
          autoComplete="off"
        />
        {loading ? <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {term.length >= 2 && !loading && visible.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">Eşleşen hasta bulunamadı.</p>
      ) : null}
      {visible.length > 0 ? (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card" role="listbox" aria-label="Hasta sonuçları">
          {visible.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onChange(p);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">{formatPhone(p.phone)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
