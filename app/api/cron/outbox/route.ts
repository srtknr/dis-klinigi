import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processOutbox } from "@/lib/jobs/side-effects";
import { logger } from "@/lib/logger";

/**
 * Bildirim ve Google Calendar outbox'ını işler. Zamanlanmış görev (cron) tarafından
 * dakikada bir çağrılması önerilir:  Authorization: Bearer <CRON_SECRET>
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || provided.length !== secret.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  try {
    const result = await processOutbox(100);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("cron.outbox_failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
