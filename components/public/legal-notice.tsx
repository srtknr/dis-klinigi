import { TriangleAlert } from "lucide-react";

export function LegalTemplateNotice() {
  return (
    <div className="flex gap-3 rounded-xl border border-[#ead7b3] bg-warning-soft p-4 text-sm text-warning-foreground">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        Bu metin, yazılımla birlikte gelen <strong>örnek bir şablondur</strong> ve hukuki danışmanlık yerine geçmez.
        Yayına almadan önce kliniğin gerçek veri işleme süreçlerine göre bir hukuk uzmanı tarafından gözden geçirilmeli
        ve güncellenmelidir.
      </p>
    </div>
  );
}
