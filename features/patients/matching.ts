import "server-only";
import type { DbOrTx } from "@/lib/db";
import { normalizeSearch } from "@/lib/text";

export type PatientCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  createdAt: Date;
};

/**
 * Aynı klinikte aynı telefonla kayıtlı hastaları bulur.
 * - exact: telefon + ad + soyad birebir eşleşir → otomatik ilişkilendirme güvenlidir
 * - candidates: aynı telefon, farklı ad (ör. aile bireyi) → kullanıcı seçmelidir
 */
export async function findPatientMatches(
  client: DbOrTx,
  clinicId: string,
  phone: string,
  firstName?: string,
  lastName?: string,
): Promise<{ exact: PatientCandidate | null; candidates: PatientCandidate[] }> {
  const candidates = await client.patient.findMany({
    where: { clinicId, phone },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  if (!firstName || !lastName) return { exact: null, candidates };
  const target = normalizeSearch(`${firstName} ${lastName}`);
  const exactMatches = candidates.filter((c) => normalizeSearch(`${c.firstName} ${c.lastName}`) === target);
  return { exact: exactMatches.length === 1 ? exactMatches[0]! : null, candidates };
}

export function buildSearchName(firstName: string, lastName: string): string {
  return normalizeSearch(`${firstName} ${lastName}`);
}
