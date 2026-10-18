/**
 * Geliştirme demo verisi. Tüm klinik, doktor ve hasta bilgileri KURGUSALDIR.
 * Production ortamında çalışmayı reddeder; varsayılan şifreli hesap oluşturmaz.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type AppointmentStatus } from "../generated/prisma/client";
import { DEFAULT_ROLE_PERMISSIONS } from "../lib/permissions";
import { normalizeSearch } from "../lib/text";
import { addDaysToKey, dateKeyToDateOnly, isoWeekdayOfKey, todayKey, zonedTimeToUtc } from "../lib/time";

if (process.env.NODE_ENV === "production") {
  console.error("Seed production ortamında çalıştırılamaz.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const SLUG = process.env.PUBLIC_CLINIC_SLUG ?? "demo-klinik";
const PASSWORD = process.env.SEED_DEMO_PASSWORD || "Demo1234!";
const DEMO_EMAILS = ["owner@demo-klinik.test", "hekim@demo-klinik.test", "editor@demo-klinik.test"];

const searchName = (f: string, l: string) => normalizeSearch(`${f} ${l}`);

/** Bugünden itibaren ileri/geri, hafta sonuna denk gelmeyen ilk iş günü */
function workday(offset: number): string {
  let key = addDaysToKey(todayKey(), offset);
  const step = offset < 0 ? -1 : 1;
  while (isoWeekdayOfKey(key) > 5) key = addDaysToKey(key, step);
  return key;
}

async function reset() {
  const clinic = await db.clinic.findUnique({ where: { slug: SLUG } });
  if (clinic) {
    await db.treatmentRecord.deleteMany({ where: { clinicId: clinic.id } });
    await db.appointment.deleteMany({ where: { clinicId: clinic.id } });
    await db.clinic.delete({ where: { id: clinic.id } });
  }
  await db.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
}

async function main() {
  await reset();
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const clinic = await db.clinic.create({
    data: {
      slug: SLUG,
      name: "Demo Diş Kliniği",
      isDemo: true,
      tagline: "Sağlıklı gülüşler için sakin, özenli ve şeffaf diş hekimliği.",
      about:
        "Bu web sitesi bir demo uygulamasıdır. Klinik adı, adres, hekimler ve tüm içerikler örnek amaçlıdır; gerçek bir sağlık kuruluşunu temsil etmez.",
      phone: "0212 000 00 00",
      email: "info@demo-klinik.test",
      notificationEmail: "serhatkenar39@gmail.com",
      address: "Örnek Mahallesi, Demo Caddesi No: 1",
      city: "Şişli / İstanbul",
      workingHoursText: "Pazartesi – Cuma: 09:00 – 18:00 · Cumartesi: 10:00 – 14:00 · Pazar: Kapalı",
      mapEmbedUrl:
        "https://www.openstreetmap.org/export/embed.html?bbox=28.975%2C41.050%2C29.005%2C41.070&layer=mapnik",
    },
  });

  const serviceDefs = [
    ["genel-muayene", "Genel Muayene ve Kontrol", "Ağız ve diş sağlığınızın kapsamlı değerlendirmesi, gerekirse tedavi planı.", 30],
    ["dis-tasi-temizligi", "Diş Taşı Temizliği", "Diş taşı ve plak temizliği ile diş eti sağlığının korunması.", 45],
    ["dolgu", "Dolgu Tedavisi", "Çürük dokunun temizlenip estetik dolgu ile onarılması.", 45],
    ["kanal-tedavisi", "Kanal Tedavisi", "Enfekte diş pulpasının tedavisi ile dişin korunması.", 60],
    ["dis-cekimi", "Diş Çekimi", "Gerekli durumlarda konforlu ve kontrollü diş çekimi.", 30],
    ["implant", "İmplant Değerlendirmesi", "Eksik dişler için implant uygunluğunun değerlendirilmesi.", 30],
    ["beyazlatma", "Diş Beyazlatma", "Klinik ortamında kontrollü diş beyazlatma uygulaması.", 60],
    ["ortodonti", "Ortodonti Konsültasyonu", "Diş ve çene düzensizlikleri için tedavi seçeneklerinin değerlendirilmesi.", 30],
  ] as const;
  const services = await Promise.all(
    serviceDefs.map(([slug, name, description, durationMinutes], i) =>
      db.service.create({ data: { clinicId: clinic.id, slug, name, description, durationMinutes, sortOrder: i } }),
    ),
  );
  const svc = Object.fromEntries(services.map((s) => [s.slug, s]));

  const weekdays = (start: number, end: number, extra?: { sat?: [number, number] }) => [
    ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: start, endMinute: end, breakStartMinute: 750, breakEndMinute: 810 })),
    ...(extra?.sat ? [{ weekday: 6, startMinute: extra.sat[0], endMinute: extra.sat[1] }] : []),
  ];

  const elif = await db.dentistProfile.create({
    data: {
      clinicId: clinic.id,
      slug: "elif-yildiz",
      title: "Dt.",
      firstName: "Elif",
      lastName: "Yıldız",
      specialty: "Restoratif Diş Tedavisi ve Estetik",
      bio: "Demo profil. Koruyucu diş hekimliği, estetik dolgular ve gülüş tasarımı alanlarında çalışan örnek hekim profili.",
      slotMinutes: 30,
      sortOrder: 1,
      workingHours: { create: weekdays(540, 1080, { sat: [600, 840] }) },
    },
  });
  const mert = await db.dentistProfile.create({
    data: {
      clinicId: clinic.id,
      slug: "mert-aydin",
      title: "Uzm. Dt.",
      firstName: "Mert",
      lastName: "Aydın",
      specialty: "Ağız, Diş ve Çene Cerrahisi",
      bio: "Demo profil. Diş çekimi, gömülü diş operasyonları ve implant planlaması konularında çalışan örnek uzman hekim profili.",
      slotMinutes: 45,
      sortOrder: 2,
      workingHours: { create: weekdays(600, 1080) },
    },
  });
  await db.dentistProfile.create({
    data: {
      clinicId: clinic.id,
      slug: "zeynep-kaya",
      title: "Dt.",
      firstName: "Zeynep",
      lastName: "Kaya",
      specialty: "Ortodonti",
      bio: "Demo profil. Çocuk ve yetişkin ortodontisi, şeffaf plak tedavileri konusunda çalışan örnek hekim profili.",
      slotMinutes: 30,
      sortOrder: 3,
      acceptsOnlineBooking: false,
      workingHours: { create: [2, 4].map((weekday) => ({ weekday, startMinute: 600, endMinute: 1020 })) },
    },
  });

  // İzin örneği: Mert Aydın için 10 iş günü sonrası tam gün izin
  const leaveDay = workday(10);
  await db.blockedTime.create({
    data: {
      clinicId: clinic.id,
      dentistId: mert.id,
      type: "LEAVE",
      startsAt: zonedTimeToUtc(leaveDay, 0),
      endsAt: zonedTimeToUtc(addDaysToKey(leaveDay, 1), 0),
      reason: "Yıllık izin (demo)",
    },
  });

  const owner = await db.user.create({
    data: {
      email: DEMO_EMAILS[0]!,
      name: "Demo Klinik Sahibi",
      passwordHash,
      memberships: { create: { clinicId: clinic.id, role: "OWNER", permissions: [] } },
    },
  });
  const dentistUser = await db.user.create({
    data: {
      email: DEMO_EMAILS[1]!,
      name: "Dt. Elif Yıldız",
      passwordHash,
      memberships: { create: { clinicId: clinic.id, role: "DENTIST", permissions: DEFAULT_ROLE_PERMISSIONS.DENTIST } },
    },
  });
  await db.dentistProfile.update({ where: { id: elif.id }, data: { userId: dentistUser.id } });
  await db.user.create({
    data: {
      email: DEMO_EMAILS[2]!,
      name: "Demo Resepsiyon (Editör)",
      passwordHash,
      memberships: {
        create: {
          clinicId: clinic.id,
          role: "EDITOR",
          permissions: ["APPOINTMENT_VIEW", "APPOINTMENT_CREATE", "PATIENT_VIEW", "DENTIST_VIEW"],
        },
      },
    },
  });

  const patientDefs = [
    ["Ayşe", "Demir", "+905550000001", "ayse.demir@example.com", -120],
    ["Mehmet", "Çelik", "+905550000002", null, -90],
    ["Fatma", "Şahin", "+905550000003", "fatma.sahin@example.com", -60],
    ["Ali", "Öztürk", "+905550000004", null, -45],
    ["Zehra", "Arslan", "+905550000005", "zehra.arslan@example.com", -20],
    ["Burak", "Koç", "+905455015611", "burak.koc@example.com", -10],
    ["Selin", "Kurt", "+905550000007", null, -3],
  ] as const;
  const patients = [];
  for (const [firstName, lastName, phone, email, daysAgo] of patientDefs) {
    patients.push(
      await db.patient.create({
        data: {
          clinicId: clinic.id,
          firstName,
          lastName,
          searchName: searchName(firstName, lastName),
          phone,
          email,
          createdById: owner.id,
          createdAt: zonedTimeToUtc(addDaysToKey(todayKey(), daysAgo), 600),
        },
      }),
    );
  }
  const [ayse, mehmet, fatma, ali, zehra, burak, selin] = patients as [typeof patients[number], ...typeof patients];

  type ApptDef = {
    dentist: typeof elif;
    patient: (typeof patients)[number] | null;
    requester?: { firstName: string; lastName: string; phone: string; email?: string };
    day: string;
    minute: number;
    duration?: number;
    status: AppointmentStatus;
    service: keyof typeof svc;
    source?: "PUBLIC_WEBSITE" | "ADMIN_PANEL";
    message?: string;
  };
  const defs: ApptDef[] = [
    { dentist: elif, patient: ayse!, day: workday(-30), minute: 600, status: "COMPLETED", service: "genel-muayene" },
    { dentist: mert, patient: ayse!, day: workday(-14), minute: 660, duration: 45, status: "COMPLETED", service: "dis-cekimi" },
    { dentist: elif, patient: mehmet!, day: workday(-7), minute: 630, status: "NO_SHOW", service: "dolgu" },
    { dentist: elif, patient: fatma!, day: workday(-5), minute: 720, status: "CANCELLED", service: "dis-tasi-temizligi" },
    { dentist: elif, patient: ali!, day: workday(-2), minute: 840, status: "COMPLETED", service: "kanal-tedavisi", duration: 60 },
    // Dashboard'daki "bugünkü randevular" için doğrudan bugüne (hafta sonu olsa da panelden oluşturulmuş gibi)
    { dentist: elif, patient: zehra!, day: todayKey(), minute: 600, status: "CONFIRMED", service: "genel-muayene" },
    { dentist: mert, patient: burak!, day: todayKey(), minute: 690, duration: 45, status: "CONFIRMED", service: "implant" },
    { dentist: elif, patient: selin!, day: workday(1), minute: 570, status: "CONFIRMED", service: "beyazlatma", duration: 60 },
    { dentist: mert, patient: ayse!, day: workday(3), minute: 600, duration: 45, status: "CONFIRMED", service: "genel-muayene" },
    {
      dentist: elif,
      patient: null,
      requester: { firstName: "Deniz", lastName: "Yılmaz", phone: "+905550000099", email: "deniz.yilmaz@example.com" },
      day: workday(2),
      minute: 660,
      status: "PENDING",
      service: "dolgu",
      source: "PUBLIC_WEBSITE",
      message: "Sol alt tarafta hassasiyet var.",
    },
    {
      dentist: mert,
      patient: null,
      // Aynı telefon, farklı ad: eşleşme belirsiz → admin onayda mevcut hastayı seçer veya yeni kayıt açar
      requester: { firstName: "Ece", lastName: "Demir", phone: "+905550000001" },
      day: workday(4),
      minute: 720,
      duration: 45,
      status: "PENDING",
      service: "genel-muayene",
      source: "PUBLIC_WEBSITE",
    },
    { dentist: elif, patient: mehmet!, day: workday(6), minute: 900, status: "PENDING", service: "dolgu", source: "PUBLIC_WEBSITE" },
    { dentist: elif, patient: fatma!, day: workday(5), minute: 600, status: "REJECTED", service: "beyazlatma", source: "PUBLIC_WEBSITE" },
  ];

  const appointmentIds: Record<string, string> = {};
  for (const [index, d] of defs.entries()) {
    const duration = d.duration ?? d.dentist.slotMinutes;
    const startsAt = zonedTimeToUtc(d.day, d.minute);
    const endsAt = zonedTimeToUtc(d.day, d.minute + duration);
    const req = d.requester ?? {
      firstName: d.patient!.firstName,
      lastName: d.patient!.lastName,
      phone: d.patient!.phone,
      email: d.patient!.email ?? undefined,
    };
    const source = d.source ?? "ADMIN_PANEL";
    const created = await db.appointment.create({
      data: {
        clinicId: clinic.id,
        dentistId: d.dentist.id,
        patientId: d.patient?.id ?? null,
        serviceId: svc[d.service]!.id,
        startsAt,
        endsAt,
        status: d.status,
        source,
        requesterFirstName: req.firstName,
        requesterLastName: req.lastName,
        requesterPhone: req.phone,
        requesterEmail: req.email ?? null,
        reason: svc[d.service]!.name,
        patientMessage: d.message ?? null,
        privacyNoticeAckAt: source === "PUBLIC_WEBSITE" ? new Date() : null,
        privacyNoticeVer: source === "PUBLIC_WEBSITE" ? "2026-10-v1" : null,
        explicitConsentAt: d.message ? new Date() : null,
        createdById: source === "ADMIN_PANEL" ? owner.id : null,
        statusHistory: {
          create: [
            { toStatus: "PENDING", event: source === "PUBLIC_WEBSITE" ? "REQUESTED" : "CREATED", changedById: source === "ADMIN_PANEL" ? owner.id : null },
            ...(d.status !== "PENDING"
              ? [
                  ...(d.status !== "REJECTED" ? [{ fromStatus: "PENDING" as const, toStatus: "CONFIRMED" as const, event: "CONFIRMED", changedById: owner.id }] : []),
                  ...(d.status !== "CONFIRMED"
                    ? [{ fromStatus: d.status === "REJECTED" ? ("PENDING" as const) : ("CONFIRMED" as const), toStatus: d.status, event: d.status, changedById: owner.id }]
                    : []),
                ]
              : []),
          ],
        },
      },
    });
    appointmentIds[index] = created.id;
  }

  await db.appointmentNote.create({
    data: { appointmentId: appointmentIds[5]!, authorId: owner.id, body: "Hasta sabah ilk randevuyu tercih ediyor. (demo not)" },
  });
  await db.patientNote.create({
    data: { clinicId: clinic.id, patientId: ayse!.id, authorId: owner.id, body: "Randevu hatırlatmaları için öğleden sonra aranmayı tercih ediyor. (demo)" },
  });

  // Muayene geçmişi (kurgusal). Randevudan bağımsız klinik kayıtlar.
  await db.treatmentRecord.create({
    data: {
      clinicId: clinic.id,
      patientId: ayse!.id,
      dentistId: elif.id,
      appointmentId: appointmentIds[0]!,
      visitDate: dateKeyToDateOnly(defs[0]!.day),
      procedure: "Genel muayene ve panoramik röntgen değerlendirmesi",
      examinationNote: "Sağ alt bölgede iki dişte ileri derecede harabiyet gözlendi. Çekim için cerrahi değerlendirme önerildi. (demo)",
      nextVisitPlan: "Cerrahi değerlendirme",
      nextVisitTodo: "Uzm. Dt. Mert Aydın ile çekim planlaması",
      createdById: dentistUser.id,
    },
  });
  await db.treatmentRecord.create({
    data: {
      clinicId: clinic.id,
      patientId: ayse!.id,
      dentistId: mert.id,
      appointmentId: appointmentIds[1]!,
      visitDate: dateKeyToDateOnly(defs[1]!.day),
      procedure: "İki diş çekimi",
      examinationNote: "Lokal anestezi altında iki diş çekimi sorunsuz tamamlandı. Hastaya çekim sonrası bakım talimatları verildi. (demo)",
      nextVisitPlan: "Kontrol muayenesi",
      nextVisitTodo: "İyileşme kontrolü, implant için kemik değerlendirmesi",
      createdById: owner.id,
    },
  });
  await db.treatmentRecord.create({
    data: {
      clinicId: clinic.id,
      patientId: ali!.id,
      dentistId: elif.id,
      appointmentId: appointmentIds[4]!,
      visitDate: dateKeyToDateOnly(defs[4]!.day),
      procedure: "Kanal tedavisi (1. seans)",
      examinationNote: "Kanal genişletme ve geçici dolgu yapıldı. (demo)",
      nextVisitPlan: "Kanal tedavisi 2. seans",
      nextVisitTodo: "Kanal dolumu ve kalıcı dolgu",
      createdById: dentistUser.id,
    },
  });

  console.log("\n✔ Demo verisi oluşturuldu (tüm içerikler kurgusaldır).");
  console.log(`  Klinik: ${clinic.name} (/${SLUG})`);
  console.log("  Hesaplar (yalnızca geliştirme):");
  for (const email of DEMO_EMAILS) console.log(`   - ${email} / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
