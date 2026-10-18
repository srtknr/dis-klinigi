import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getPublicClinic } from "@/features/public/queries";

/** İçerik admin panelinden yönetildiği için public sayfalar her istekte güncel veriyle oluşturulur. */
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const clinic = await getPublicClinic();
  if (!clinic) {
    return (
      <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-6 py-24 text-center">
        <h1 className="font-display text-3xl">Kurulum tamamlanmadı</h1>
        <p className="mt-3 text-muted-foreground">
          Klinik kaydı bulunamadı. Geliştirme ortamında <code className="rounded bg-muted px-1">npm run db:seed</code> komutunu
          çalıştırın veya <code className="rounded bg-muted px-1">PUBLIC_CLINIC_SLUG</code> değerini kontrol edin.
        </p>
      </main>
    );
  }
  return (
    <>
      <a href="#icerik" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
        İçeriğe geç
      </a>
      <SiteHeader clinicName={clinic.name} />
      <main id="icerik" className="flex-1">
        {children}
      </main>
      <SiteFooter clinic={clinic} />
    </>
  );
}
