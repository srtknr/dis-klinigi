import { CircleAlert, CircleCheck } from "lucide-react";
import { BrandMark } from "@/components/public/brand";
import { AnamnesisForm } from "@/components/patient-form/anamnesis-form";
import { getPublicForm } from "@/features/forms/service";

const MESSAGES = {
  invalid: { title: "Bağlantı geçersiz", body: "Bu bağlantı bulunamadı. Lütfen size gönderilen bağlantının tamamını kullandığınızdan emin olun veya kliniğimizle iletişime geçin." },
  expired: { title: "Bağlantının süresi dolmuş", body: "Bu formun geçerlilik süresi sona erdi. Yeni bir bağlantı için lütfen kliniğimizle iletişime geçin." },
  cancelled: { title: "Bağlantı iptal edilmiş", body: "Bu bağlantı artık kullanılamıyor. Yeni bir bağlantı için lütfen kliniğimizle iletişime geçin." },
  completed: { title: "Formunuz alındı", body: "Bu form daha önce gönderilmiş. Teşekkür ederiz; hekiminiz bilgilerinizi inceleyecektir." },
} as const;

export default async function PatientFormPage({ params }: PageProps<"/anamnez/[token]">) {
  const { token } = await params;
  const form = await getPublicForm(token);

  if (form.state !== "open") {
    const message = MESSAGES[form.state];
    const Icon = form.state === "completed" ? CircleCheck : CircleAlert;
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        <Icon className="mx-auto size-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">{message.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message.body}</p>
        {form.clinicName ? <p className="mt-6 text-xs text-muted-foreground">{form.clinicName}</p> : null}
      </div>
    );
  }

  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <BrandMark />
        <div>
          <p className="text-sm font-medium">{form.clinicName}</p>
          <h1 className="text-lg font-semibold tracking-tight">Sağlık Geçmişi Formu</h1>
        </div>
      </header>
      <AnamnesisForm token={token} clinicName={form.clinicName} prefill={form.prefill} />
    </>
  );
}
