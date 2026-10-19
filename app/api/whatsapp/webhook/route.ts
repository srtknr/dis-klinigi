import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { processInboundWebhook } from "@/lib/notifications/whatsapp/inbound";
import { verifyMetaSignature } from "@/lib/notifications/whatsapp/webhook-parse";

/**
 * Meta WhatsApp webhook'u.
 *  GET : Meta'nın webhook doğrulaması (hub.verify_token == WHATSAPP_VERIFY_TOKEN)
 *  POST: Gelen mesajlar; X-Hub-Signature-256 WHATSAPP_APP_SECRET ile doğrulanır.
 * Meta, 2xx dönmezsek aynı olayı tekrar gönderir; işleme idempotenttir.
 */
export async function GET(request: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const params = request.nextUrl.searchParams;
  const provided = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  const ok =
    Boolean(verifyToken) &&
    params.get("hub.mode") === "subscribe" &&
    provided.length === verifyToken!.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(verifyToken!));
  if (!ok || !challenge) return new NextResponse("Yetkisiz", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return NextResponse.json({ error: "Yapılandırılmamış" }, { status: 503 });

  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: "Geçersiz imza" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Geçersiz gövde" }, { status: 400 });
  }
  try {
    const result = await processInboundWebhook(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("whatsapp.webhook_failed", error);
    // 500: Meta olayı yeniden dener
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
