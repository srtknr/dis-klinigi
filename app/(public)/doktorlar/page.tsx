import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserRound } from "lucide-react";
import { DentistCard } from "@/components/public/dentist-card";
import { PageIntro } from "@/components/public/page-intro";
import { EmptyState } from "@/components/shared/empty-state";
import { getPublicClinic, getPublicDentists } from "@/features/public/queries";

export const metadata: Metadata = { title: "Doktorlarımız" };

export default async function DentistsPage() {
  const clinic = await getPublicClinic();
  if (!clinic) notFound();
  const dentists = await getPublicDentists(clinic.id);
  return (
    <>
      <PageIntro
        eyebrow="Ekibimiz"
        title="Doktorlarımız"
        description="Hekimlerimizin uzmanlık alanlarını ve çalışma günlerini inceleyebilir, uygun hekimden online randevu talebi oluşturabilirsiniz."
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {dentists.length === 0 ? (
          <EmptyState icon={UserRound} title="Henüz hekim bilgisi eklenmedi" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dentists.map((d) => (
              <DentistCard key={d.id} dentist={d} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
