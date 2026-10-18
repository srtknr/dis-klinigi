import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/current";
import { randomToken } from "@/lib/crypto";
import { getGoogleConfig } from "@/lib/google-calendar/config";
import { buildAuthorizationUrl, createPkcePair } from "@/lib/google-calendar/oauth";
import { can } from "@/lib/permissions";

const OAUTH_COOKIE = "dk_google_oauth";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.redirect(new URL("/giris", request.url));
  if (!can(ctx, "SETTINGS_MANAGE")) return NextResponse.redirect(new URL("/admin/yetkisiz", request.url));

  const config = getGoogleConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/admin/entegrasyonlar?google=not_configured", request.url));
  }
  const dentistId = request.nextUrl.searchParams.get("dentistId");
  const state = randomToken(24);
  const { verifier, challenge } = createPkcePair();

  const response = NextResponse.redirect(buildAuthorizationUrl(config, state, challenge));
  response.cookies.set(
    OAUTH_COOKIE,
    JSON.stringify({ state, verifier, dentistId: dentistId && /^[a-z0-9]{10,40}$/i.test(dentistId) ? dentistId : null, userId: ctx.userId }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/google/oauth",
      maxAge: 600,
    },
  );
  return response;
}
