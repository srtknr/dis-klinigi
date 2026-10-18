/**
 * İstenen en düşük kapsamlar:
 * - calendar.events: yalnızca etkinlik oluşturma/güncelleme/silme (takvim listesi veya ayarlarına erişmez)
 * - calendar.freebusy: yalnızca dolu/boş bilgisi (etkinlik içeriklerini okumaz) — müsaitlik hesabı için
 * - openid email: bağlanan hesabın e-posta adresini panelde göstermek için
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export type GoogleOAuthConfig = { clientId: string; clientSecret: string; redirectUri: string };

export function getGoogleConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() || `${process.env.APP_URL ?? "http://localhost:3000"}/api/google/oauth/callback`;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return getGoogleConfig() !== null;
}
