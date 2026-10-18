import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-dk_session" : "dk_session";

/**
 * İyimser kontrol: oturum çerezi yoksa admin sayfalarını giriş ekranına yönlendirir.
 * Asıl kimlik ve yetki doğrulaması her sayfa, server action ve route handler içinde yapılır.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/giris", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
