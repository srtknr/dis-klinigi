import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalTemplateNotice } from "@/components/public/legal-notice";
import { PageIntro } from "@/components/public/page-intro";
import { getPublicClinic } from "@/features/public/queries";

export const metadata: Metadata = { title: "Gizlilik ve Çerez Politikası" };

export default async function PrivacyPage() {
  const clinic = await getPublicClinic();
  if (!clinic) notFound();
  return (
    <>
      <PageIntro title="Gizlilik ve Çerez Politikası" />
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 leading-relaxed sm:px-6 [&_h2]:font-display [&_h2]:text-xl [&_li]:ml-5 [&_li]:list-disc">
        <LegalTemplateNotice />
        <section className="space-y-2">
          <h2>Çerezler</h2>
          <p>
            Bu web sitesi, ziyaretçiler için reklam, analiz veya izleme çerezi kullanmaz. Yalnızca klinik personelinin
            yönetim paneline güvenli giriş yapabilmesi için zorunlu bir oturum çerezi ve Google Takvim bağlantısı
            sırasında kısa süreli bir güvenlik çerezi kullanılır. Bu çerezler hizmetin çalışması için gereklidir.
          </p>
        </section>
        <section className="space-y-2">
          <h2>Güvenlik</h2>
          <ul>
            <li>Bağlantılar HTTPS ile şifrelenmelidir (üretim ortamı).</li>
            <li>Yönetim paneline erişim rol ve yetki bazlıdır; işlemler denetim kaydında tutulur.</li>
            <li>Takvim entegrasyonu erişim anahtarları veritabanında şifrelenmiş olarak saklanır.</li>
            <li>SMS ve takvim içeriklerine muayene, teşhis veya tedavi bilgisi eklenmez.</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h2>Kişisel veriler</h2>
          <p>
            Kişisel verilerin işlenmesine ilişkin ayrıntılı bilgi için KVKK Aydınlatma Metni’ni inceleyebilirsiniz. Sorularınız
            için {clinic.email ?? "kliniğin iletişim kanalları"} üzerinden bize ulaşabilirsiniz.
          </p>
        </section>
      </article>
    </>
  );
}
