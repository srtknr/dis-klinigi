import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { AnswerSection } from "@/lib/forms/validate";

// DejaVu Sans: Türkçe karakterleri (ğ, ş, ı, İ…) tam destekleyen, gömülebilir font
const FONT_DIR = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");
const REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

export type FormPdfInput = {
  clinicName: string;
  title: string;
  patientName: string;
  completedAt: Date;
  signatureName: string | null;
  sections: AnswerSection[];
};

const fmt = (d: Date) => d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "long", timeStyle: "short" });

export function renderFormPdf(input: FormPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
      info: { Title: `${input.title} – ${input.patientName}`, Author: input.clinicName },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - 100;

    doc.font(BOLD).fontSize(10).fillColor("#6b5f55").text(input.clinicName);
    doc.moveDown(0.3).font(BOLD).fontSize(17).fillColor("#1f1a17").text(input.title);
    doc.moveDown(0.6).font(REGULAR).fontSize(10.5).fillColor("#1f1a17");
    doc.text(`Hasta: ${input.patientName}`);
    doc.text(`Doldurulma tarihi: ${fmt(input.completedAt)}`);
    doc.moveDown(0.4);
    doc.moveTo(50, doc.y).lineTo(50 + contentWidth, doc.y).strokeColor("#cbbcab").lineWidth(0.8).stroke();
    doc.moveDown(0.8);

    for (const section of input.sections) {
      // Başlık sayfa sonunda yalnız kalmasın
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.font(BOLD).fontSize(12.5).fillColor("#33432d").text(section.title);
      doc.moveDown(0.4);
      for (const row of section.rows) {
        if (doc.y > doc.page.height - 100) doc.addPage();
        doc.font(BOLD).fontSize(9).fillColor("#6b5f55").text(row.label, { width: contentWidth });
        const unanswered = row.value === "Yanıtlanmadı";
        doc.font(REGULAR).fontSize(10.5).fillColor(unanswered ? "#9a9086" : "#1f1a17").text(row.value, { width: contentWidth });
        doc.moveDown(0.55);
      }
      doc.moveDown(0.6);
    }

    if (input.signatureName) {
      if (doc.y > doc.page.height - 130) doc.addPage();
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(50 + contentWidth, doc.y).strokeColor("#cbbcab").lineWidth(0.8).stroke();
      doc.moveDown(0.6);
      doc.font(REGULAR).fontSize(9.5).fillColor("#6b5f55").text("Hasta tarafından bağlantı üzerinden dijital olarak doldurulmuş ve onaylanmıştır.");
      doc.font(BOLD).fontSize(11).fillColor("#1f1a17").text(`Dijital imza: ${input.signatureName}`);
    }

    // Sayfa numaraları
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.font(REGULAR).fontSize(8).fillColor("#9a9086");
      doc.text(`Sayfa ${i + 1} / ${range.count}`, 50, doc.page.height - 35, { width: contentWidth, align: "right", lineBreak: false });
    }
    doc.end();
  });
}
