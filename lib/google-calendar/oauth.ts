import { createHash, randomBytes } from "node:crypto";
import {
  GOOGLE_AUTH_URL,
  GOOGLE_REVOKE_URL,
  GOOGLE_SCOPES,
  GOOGLE_TOKEN_URL,
  type GoogleOAuthConfig,
} from "@/lib/google-calendar/config";
import { GoogleApiError } from "@/lib/google-calendar/errors";

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
};

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizationUrl(config: GoogleOAuthConfig, state: string, codeChallenge: string): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function postForm(url: string, body: Record<string, string>, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(10_000),
  });
}

export async function exchangeCodeForTokens(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleTokenResponse> {
  const res = await postForm(
    GOOGLE_TOKEN_URL,
    {
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    },
    fetchImpl,
  );
  if (!res.ok) {
    throw new GoogleApiError(`Token değişimi başarısız (HTTP ${res.status})`, res.status, false, true);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleTokenResponse> {
  const res = await postForm(
    GOOGLE_TOKEN_URL,
    {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
    fetchImpl,
  );
  if (!res.ok) {
    let reason = "";
    try {
      reason = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      // yanıt gövdesi JSON değil
    }
    const revoked = reason === "invalid_grant";
    throw new GoogleApiError(
      revoked ? "Google erişim izni geri alınmış veya süresi dolmuş." : `Token yenileme başarısız (HTTP ${res.status})`,
      res.status,
      !revoked && (res.status >= 500 || res.status === 429),
      revoked,
    );
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function revokeToken(token: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await postForm(GOOGLE_REVOKE_URL, { token }, fetchImpl).catch(() => undefined);
}

/** Google'dan doğrudan TLS ile alınan id_token'dan yalnızca görüntüleme amaçlı e-posta okunur. */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      email?: string;
    };
    return payload.email ?? null;
  } catch {
    return null;
  }
}
