import type { FormDefinition } from "@/lib/forms/types";

export const ANAMNESIS_FORM_KEY = "anamnez-v1";
/** Hastaya gönderilen bağlantının geçerlilik süresi */
export const FORM_LINK_VALID_DAYS = 7;

/** Onay metinlerinde kullanılır; render sırasında klinik adıyla değiştirilir. */
export const CLINIC_PLACEHOLDER = "{klinik}";

const yesNo = [
  { value: "hayir", label: "Hayır" },
  { value: "evet", label: "Evet" },
];

export const ANAMNESIS_FORM: FormDefinition = {
  key: ANAMNESIS_FORM_KEY,
  title: "Sağlık Geçmişi (Anamnez) Formu",
  steps: [
    {
      id: "genel",
      title: "Genel Bilgiler",
      fields: [
        { id: "adSoyad", type: "text", label: "Ad Soyad", required: true, placeholder: "Adınızı ve soyadınızı girin", maxLength: 120 },
        { id: "meslek", type: "text", label: "Meslek", placeholder: "Mesleğinizi girin", maxLength: 80 },
        { id: "dogumTarihi", type: "date", kind: "birth", label: "Doğum Tarihi", required: true },
        {
          id: "cinsiyet",
          type: "radio",
          label: "Cinsiyet",
          required: true,
          options: [
            { value: "kadin", label: "Kadın" },
            { value: "erkek", label: "Erkek" },
            { value: "belirtmek-istemiyorum", label: "Belirtmek istemiyorum" },
          ],
        },
        { id: "boy", type: "number", label: "Boy (cm)", placeholder: "örn. 175", min: 50, max: 250 },
        { id: "kilo", type: "number", label: "Kilo (kg)", placeholder: "örn. 70", min: 10, max: 400 },
        { id: "telefon", type: "tel", label: "Telefon Numarası", placeholder: "Telefon numaranızı girin", maxLength: 30 },
        { id: "eposta", type: "email", label: "E-posta", placeholder: "E-posta adresinizi girin", maxLength: 120 },
        {
          id: "sigara",
          type: "radio",
          label: "Şu anda sigara içiyor musunuz?",
          options: [
            { value: "hayir", label: "Hayır" },
            { value: "ara-sira", label: "Ara sıra" },
            { value: "gunluk", label: "Günlük" },
            { value: "biraktim", label: "İçerdim ama bıraktım" },
          ],
        },
        {
          id: "alkol",
          type: "radio",
          label: "Alkol tüketiyor musunuz?",
          options: [
            { value: "hayir", label: "Hayır" },
            { value: "ara-sira", label: "Ara sıra" },
            { value: "haftalik", label: "Haftalık" },
            { value: "gunluk", label: "Günlük" },
          ],
        },
      ],
    },
    {
      id: "tibbi",
      title: "Tıbbi Geçmiş",
      fields: [
        {
          id: "ilaclar",
          type: "checkbox",
          label: "Şu anda herhangi bir ilaç kullanıyor musunuz?",
          options: [
            { value: "kullanmiyorum", label: "İlaç kullanmıyorum", exclusive: true },
            { value: "tansiyon", label: "Tansiyon ilacı" },
            { value: "diyabet", label: "Diyabet ilacı" },
            { value: "tiroid", label: "Tiroid ilacı" },
            { value: "kan-sulandirici", label: "Kan sulandırıcı" },
            { value: "antidepresan", label: "Antidepresan" },
            { value: "diger", label: "Diğer" },
          ],
        },
        {
          id: "ilaclarDiger",
          type: "text",
          label: "Kullandığınız diğer ilaçlar",
          required: true,
          placeholder: "Lütfen kullandığınız diğer ilaçları belirtin",
          maxLength: 300,
          showIf: { field: "ilaclar", includes: "diger" },
        },
        { id: "alerji", type: "radio", label: "Herhangi bir alerjiniz var mı?", options: yesNo },
        {
          id: "alerjiDetay",
          type: "text",
          label: "Alerjinizin türü",
          placeholder: "Örn. penisilin, lateks, lokal anestezi",
          maxLength: 300,
          showIf: { field: "alerji", includes: "evet" },
        },
        {
          id: "ameliyat",
          type: "textarea",
          label: "Herhangi bir ameliyat veya hastaneye yatış geçmişiniz var mı?",
          placeholder: "Lütfen ameliyat veya hastaneye yatışlarınızı açıklayın",
          maxLength: 1000,
        },
        {
          id: "hastaliklar",
          type: "checkbox",
          label: "Aşağıdaki sistemik hastalıklardan herhangi birine sahip misiniz?",
          options: [
            { value: "hicbiri", label: "Hiçbiri", exclusive: true },
            { value: "diyabet", label: "Diyabet" },
            { value: "hipertansiyon", label: "Hipertansiyon" },
            { value: "kalp", label: "Kalp hastalığı" },
            { value: "otoimmun", label: "Otoimmün hastalık" },
            { value: "tiroid", label: "Tiroid rahatsızlığı" },
            { value: "osteoporoz", label: "Osteoporoz" },
            { value: "kanser", label: "Kanser" },
            { value: "diger", label: "Diğer" },
          ],
        },
        {
          id: "hastaliklarDiger",
          type: "text",
          label: "Diğer durumlar",
          required: true,
          placeholder: "Lütfen diğer durumları belirtin",
          maxLength: 300,
          showIf: { field: "hastaliklar", includes: "diger" },
        },
      ],
    },
    {
      id: "dis",
      title: "Diş ve Ağız Sağlığı Geçmişi",
      fields: [
        {
          id: "disSorunlari",
          type: "checkbox",
          label: "Ana diş sorunlarınız nelerdir?",
          options: [
            { value: "curuk", label: "Diş çürüğü" },
            { value: "dis-eti", label: "Diş eti hastalığı" },
            { value: "hassasiyet", label: "Diş hassasiyeti" },
            { value: "estetik", label: "Estetik iyileştirmeler" },
            { value: "eksik", label: "Eksik dişler" },
            { value: "cene-agrisi", label: "Çene ağrısı" },
            { value: "agiz-kokusu", label: "Ağız kokusu" },
            { value: "diger", label: "Diğer" },
          ],
        },
        {
          id: "disSorunlariDiger",
          type: "text",
          label: "Diğer diş sorunları",
          placeholder: "Lütfen belirtin",
          maxLength: 300,
          showIf: { field: "disSorunlari", includes: "diger" },
        },
        {
          id: "agizSagligi",
          type: "radio",
          label: "Genel ağız sağlığınızı nasıl değerlendirirsiniz?",
          options: [
            { value: "mukemmel", label: "Mükemmel" },
            { value: "iyi", label: "İyi" },
            { value: "orta", label: "Orta" },
            { value: "kotu", label: "Kötü" },
          ],
        },
        {
          id: "sikayetler",
          type: "checkbox",
          label: "Şu anda aşağıdakilerden herhangi birini yaşıyor musunuz?",
          options: [
            { value: "hicbiri", label: "Hiçbiri", exclusive: true },
            { value: "agri-hassasiyet", label: "Diş ağrısı veya hassasiyet" },
            { value: "kanama", label: "Kanayan dişetleri" },
            { value: "sisme", label: "Şişmiş veya hassas dişetleri" },
            { value: "agiz-kurulugu", label: "Ağız kuruluğu" },
            { value: "halitozis", label: "Ağız kokusu (halitozis)" },
            { value: "cigneme", label: "Çiğneme zorluğu" },
            { value: "cene-citlama", label: "Çene ağrısı veya çıtlama" },
            { value: "gicirdatma", label: "Diş gıcırdatma veya sıkma" },
          ],
        },
      ],
    },
    {
      id: "yasam",
      title: "Yaşam Tarzı ve Toksik Yük Değerlendirmesi",
      fields: [
        { id: "uyku", type: "number", label: "Geceleri ortalama kaç saat uyuyorsunuz?", placeholder: "örn. 7.5", min: 0, max: 24, step: 0.5 },
        {
          id: "dinlenmis",
          type: "radio",
          label: "Dinlenmiş hissederek uyanıyor musunuz?",
          options: [
            { value: "evet", label: "Evet" },
            { value: "hayir", label: "Hayır" },
            { value: "bazen", label: "Bazen" },
          ],
        },
        {
          id: "stres",
          type: "radio",
          label: "Mevcut stres seviyenizi nasıl değerlendirirsiniz?",
          options: [
            { value: "dusuk", label: "Düşük" },
            { value: "orta", label: "Orta" },
            { value: "yuksek", label: "Yüksek" },
            { value: "cok-yuksek", label: "Çok Yüksek" },
          ],
        },
        {
          id: "sindirim",
          type: "checkbox",
          label: "Herhangi bir sindirim sorunu yaşıyor musunuz?",
          options: [
            { value: "hicbiri", label: "Hiçbiri", exclusive: true },
            { value: "siskinlik", label: "Şişkinlik" },
            { value: "gaz", label: "Gaz" },
            { value: "kabizlik", label: "Kabızlık" },
            { value: "ishal", label: "İshal" },
            { value: "reflu", label: "Asit reflüsü" },
            { value: "bulanti", label: "Mide bulantısı" },
          ],
        },
      ],
    },
    {
      id: "onay",
      title: "Onay ve Dijital İmza",
      fields: [
        {
          id: "onayVeri",
          type: "consent",
          required: true,
          label: `Kişisel ve tıbbi verilerimin diş değerlendirmesi ve tedavi planlaması amacıyla ${CLINIC_PLACEHOLDER} tarafından toplanmasına ve işlenmesine onay veriyorum.`,
        },
        {
          id: "onayDogru",
          type: "consent",
          required: true,
          label: "Verilen bilgilerin bildiğim kadarıyla doğru ve eksiksiz olduğunu onaylıyorum.",
        },
        { id: "onayAd", type: "text", label: "Hasta Adı (onay için)", required: true, placeholder: "Adınızı ve soyadınızı girin", maxLength: 120 },
        { id: "imza", type: "text", label: "Dijital İmza (adınızı ve soyadınızı yazın)", required: true, placeholder: "İmza olarak adınızı ve soyadınızı yazın", maxLength: 120 },
      ],
    },
  ],
};
