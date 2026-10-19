import type { Metadata } from "next";

/** Hastaya gönderilen kişisel bağlantılar: aranmasın, bağlantı üçüncü taraflara referrer ile sızmasın. */
export const metadata: Metadata = {
  title: "Sağlık Bilgi Formu",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default function FormsLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">{children}</main>;
}
