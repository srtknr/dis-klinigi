import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { GOOGLE_CALENDAR_API, getGoogleConfig } from "@/lib/google-calendar/config";
import { classifyStatus, GoogleApiError } from "@/lib/google-calendar/errors";
import { refreshAccessToken } from "@/lib/google-calendar/oauth";
import type { GoogleCalendarConnection } from "@/generated/prisma/client";

export type GoogleDeps = { fetch?: typeof fetch; now?: () => Date };

/** Geçerli bir access token döndürür; süresi dolmak üzereyse refresh token ile yeniler ve şifreli saklar. */
export async function getAccessToken(connection: GoogleCalendarConnection, deps: GoogleDeps = {}): Promise<string> {
  const now = deps.now?.() ?? new Date();
  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - 60_000 > now.getTime()) {
    return decryptSecret(connection.accessTokenEnc);
  }
  const config = getGoogleConfig();
  if (!config) throw new GoogleApiError("Google OAuth yapılandırılmamış.", 0, false, true);
  if (!connection.refreshTokenEnc) throw new GoogleApiError("Refresh token bulunmuyor; hesabı yeniden bağlayın.", 0, false, true);

  try {
    const tokens = await refreshAccessToken(config, decryptSecret(connection.refreshTokenEnc), deps.fetch);
    const expiresAt = new Date(now.getTime() + tokens.expires_in * 1000);
    await db.googleCalendarConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : undefined,
        tokenExpiresAt: expiresAt,
        status: "ACTIVE",
        lastError: null,
      },
    });
    return tokens.access_token;
  } catch (error) {
    if (error instanceof GoogleApiError && error.authFailure && !error.retryable) {
      await db.googleCalendarConnection.update({
        where: { id: connection.id },
        data: { status: "REVOKED", lastError: error.message },
      });
    }
    throw error;
  }
}

export async function googleCalendarRequest<T>(
  connection: GoogleCalendarConnection,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  deps: GoogleDeps = {},
): Promise<{ status: number; data: T | null }> {
  const fetchImpl = deps.fetch ?? fetch;
  const token = await getAccessToken(connection, deps);
  let res: Response;
  try {
    res = await fetchImpl(`${GOOGLE_CALENDAR_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    throw new GoogleApiError(
      `Google Calendar'a ulaşılamadı: ${error instanceof Error ? error.name : "ağ hatası"}`,
      0,
      true,
    );
  }

  if (res.status === 204) return { status: 204, data: null };
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : null;
  if (!res.ok) {
    const { retryable, authFailure } = classifyStatus(res.status);
    const apiMessage = (data as { error?: { message?: string } } | null)?.error?.message;
    const error = new GoogleApiError(
      `Google Calendar API hatası (HTTP ${res.status})${apiMessage ? `: ${apiMessage.slice(0, 200)}` : ""}`,
      res.status,
      retryable,
      authFailure,
    );
    (error as GoogleApiError & { data?: unknown }).data = data;
    throw error;
  }
  return { status: res.status, data };
}
