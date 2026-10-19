import { NextResponse, type NextRequest } from "next/server";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { renderFormPdf } from "@/lib/forms/pdf";
import { logger } from "@/lib/logger";
import { can } from "@/lib/permissions";
import { slugify } from "@/lib/text";
import { getFormResult } from "@/features/forms/service";

/** Tamamlanmış sağlık formunu PDF olarak indirir. Sağlık verisi içerdiği için oturum ve TREATMENT_VIEW zorunludur. */
export async function GET(request: NextRequest, { params }: RouteContext<"/admin/hastalar/[id]/formlar/[requestId]/pdf">) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.redirect(new URL("/giris", request.url));
  if (!can(ctx, "TREATMENT_VIEW")) return NextResponse.redirect(new URL("/admin/yetkisiz", request.url));

  const { id, requestId } = await params;
  try {
    const result = await getFormResult(ctx, id, requestId);
    if (result.request.status !== "COMPLETED" || !result.request.completedAt) {
      return NextResponse.json({ error: "Form henüz doldurulmadı." }, { status: 409 });
    }
    const patientName = `${result.patient.firstName} ${result.patient.lastName}`;
    const pdf = await renderFormPdf({
      clinicName: result.clinicName,
      title: result.title,
      patientName,
      completedAt: result.request.completedAt,
      signatureName: result.request.signatureName,
      sections: result.sections,
    });
    await writeAudit(db, { ctx, action: "patient_form.pdf_downloaded", entityType: "PatientFormRequest", entityId: requestId });
    const filename = `anamnez-${slugify(patientName) || "hasta"}-${result.request.completedAt.toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return NextResponse.json({ error: "Form bulunamadı." }, { status: 404 });
    logger.error("patient_form.pdf_failed", error);
    return NextResponse.json({ error: "PDF oluşturulamadı." }, { status: 500 });
  }
}
