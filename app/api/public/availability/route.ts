import { NextResponse, type NextRequest } from "next/server";
import { getAvailability } from "@/features/calendar/service";
import { getPublicClinic } from "@/features/public/queries";
import { logger } from "@/lib/logger";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { availabilityQuerySchema } from "@/lib/validations/appointment";

export async function GET(request: NextRequest) {
  const limit = await rateLimit("public-availability", getClientIp(request.headers), 120, 10 * 60);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek yapıldı. Lütfen biraz sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const parsed = availabilityQuerySchema.safeParse({
    dentistId: request.nextUrl.searchParams.get("dentistId"),
    date: request.nextUrl.searchParams.get("date"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  try {
    const clinic = await getPublicClinic();
    if (!clinic) return NextResponse.json({ error: "Klinik bulunamadı." }, { status: 404 });
    const result = await getAvailability({
      clinicId: clinic.id,
      dentistId: parsed.data.dentistId,
      dateKey: parsed.data.date,
      mode: "public",
    });
    return NextResponse.json(
      {
        slots: result.slots.map((s) => ({ time: s.time, start: s.start })),
        slotMinutes: result.slotMinutes,
        closedReason: result.closedReason,
        externalCalendarUnavailable: result.externalCalendar === "unavailable",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logger.error("public.availability_failed", error);
    return NextResponse.json({ error: "Müsait saatler şu anda yüklenemedi." }, { status: 500 });
  }
}
