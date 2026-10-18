import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { completeGoogleConnection } from "@/features/integrations/service";
import { getAuthContext } from "@/lib/auth/current";
import { logger } from "@/lib/logger";

const OAUTH_COOKIE = "dk_google_oauth";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function GET(request: NextRequest) {
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/admin/entegrasyonlar?google=${status}`, request.url));
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/google/oauth" });
    return res;
  };

  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.redirect(new URL("/giris", request.url));

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back("denied");

  let stored: { state: string; verifier: string; dentistId: string | null; userId: string } | null = null;
  try {
    stored = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "null");
  } catch {
    stored = null;
  }
  const state = params.get("state") ?? "";
  const code = params.get("code");
  // CSRF koruması: state, başlatan oturumun çerezindeki değerle eşleşmeli
  if (!stored || !code || stored.userId !== ctx.userId || !safeEqual(state, stored.state)) {
    return back("invalid_state");
  }

  try {
    await completeGoogleConnection(ctx, { code, codeVerifier: stored.verifier, dentistId: stored.dentistId });
    return back("connected");
  } catch (error) {
    logger.error("google.oauth_callback_failed", error);
    return back("failed");
  }
}
