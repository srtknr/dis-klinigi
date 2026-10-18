import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalTemplateNotice } from "@/components/public/legal-notice";
import { PageIntro } from "@/components/public/page-intro";
import { getPublicClinic } from "@/features/public/queries";
import { PRIVACY_NOTICE_VERSION } from "@/lib/validations/appointment";

export const metadata: Metadata = { title: "KVKK Aydınlatma Metni" };

export default async function KvkkPage() {
  const clinic = await getPublicClinic();
  if (!clinic) notFound();
  return (
    <>
      <PageIntro title="Kişisel Verilerin Korunması Aydınlatma Metni" description={`Sürüm: ${PRIVACY_NOTICE_VERSION}`} />
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 leading-relaxed sm:px-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc">
        <LegalTemplateNotice />

        <p>
          {clinic.name} (“Klinik”) olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında veri
          sorumlusu sıfatıyla, online randevu talebi ve hasta kayıt süreçlerinde işlenen kişisel verileriniz hakkında
          sizi bilgilendirmek isteriz.
        </p>

        <section className="space-y-2">
          <h2>İşlenen kişisel veriler</h2>
          <ul>
            <li>Kimlik bilgileri: ad, soyad</li>
            <li>İletişim bilgileri: cep telefonu numarası, e-posta adresi (isteğe bağlı)</li>
            <li>Randevu bilgileri: seçilen hekim, hizmet, tarih ve saat</li>
            <li>Açıklama alanına kendi isteğinizle yazdığınız bilgiler</li>
            <li>İşlem güvenliği bilgileri: talebin oluşturulduğu zaman ve kötüye kullanımı önlemek amacıyla tek yönlü özetlenmiş (hash) IP bilgisi</li>
            <li>Kliniğe başvurmanız hâlinde, hekiminiz tarafından kaydedilen muayene ve tedavi bilgileri (özel nitelikli sağlık verisi)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2>İşleme amaçları</h2>
          <ul>
            <li>Randevu talebinizin alınması, değerlendirilmesi, onaylanması veya size ulaşılması</li>
            <li>Randevu onayı, değişikliği ve iptaline ilişkin SMS / e-posta bilgilendirmesi yapılması</li>
            <li>Tıbbi teşhis ve tedavi hizmetlerinin yürütülmesi ve hasta kayıtlarının tutulması</li>
            <li>Yasal yükümlülüklerin yerine getirilmesi ve bilgi güvenliğinin sağlanması</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2>Hukuki sebepler</h2>
          <p>
            Kimlik, iletişim ve randevu verileriniz; bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması, veri
            sorumlusunun hukuki yükümlülüğü ve meşru menfaati hukuki sebeplerine (KVKK m.5/2) dayanılarak işlenir. Sağlık
            verileri, KVKK m.6 kapsamında kamu sağlığının korunması, koruyucu hekimlik, tıbbî teşhis ve tedavi
            hizmetlerinin yürütülmesi amacıyla sır saklama yükümlülüğü altındaki kişilerce veya açık rızanıza dayanılarak
            işlenir. Randevu formundaki açıklama alanına yazdığınız bilgiler yalnızca açık rızanız ile işlenir; bu alanı
            boş bırakarak da randevu talebi oluşturabilirsiniz.
          </p>
        </section>

        <section className="space-y-2">
          <h2>Aktarım</h2>
          <p>
            Verileriniz; randevu bildirimlerinin iletilmesi için kullanılan SMS ve e-posta hizmet sağlayıcıları ile, klinik
            tarafından etkinleştirilmesi hâlinde randevu takvimi için kullanılan takvim hizmeti sağlayıcısına yalnızca
            gerekli asgari bilgilerle (ör. ad ve randevu saati) aktarılabilir. Takvim ve SMS içeriklerine muayene, teşhis
            veya tedavi bilgisi eklenmez. Yurt dışında bulunan hizmet sağlayıcılara aktarım söz konusu olduğunda KVKK m.9
            hükümlerine uyulur.
          </p>
        </section>

        <section className="space-y-2">
          <h2>Saklama süresi</h2>
          <p>
            Verileriniz, ilgili mevzuatta öngörülen süreler ve işleme amacının gerektirdiği süre boyunca saklanır; sürenin
            sona ermesiyle silinir, yok edilir veya anonim hâle getirilir.
          </p>
        </section>

        <section className="space-y-2">
          <h2>Haklarınız</h2>
          <p>
            KVKK m.11 uyarınca; verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya
            silinmesini isteme, aktarıldığı üçüncü kişileri bilme, itiraz etme ve zararın giderilmesini talep etme
            haklarına sahipsiniz. Başvurularınızı{clinic.email ? ` ${clinic.email} adresine` : " klinik iletişim kanalları üzerinden"} iletebilirsiniz.
          </p>
        </section>

        {clinic.address ? (
          <p className="text-sm text-muted-foreground">
            Veri sorumlusu: {clinic.name} · {clinic.address}
            {clinic.city ? `, ${clinic.city}` : ""}
          </p>
        ) : null}
      </article>
    </>
  );
}
