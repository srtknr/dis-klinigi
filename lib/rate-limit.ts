import "server-only";
import { db } from "@/lib/db";
import { hashIp, sha256Hex } from "@/lib/crypto";

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

/**
 * Sabit pencereli sayaç. Veritabanında tutulduğu için birden fazla sunucu örneğinde de tutarlıdır.
 * Anahtar ham IP/e-posta içermez; özetlenerek saklanır.
 */
export async function rateLimit(scope: string, identifier: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const windowMs = windowSec * 1000;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const key = `${scope}:${sha256Hex(identifier).slice(0, 40)}`;

  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
    RETURNING "count"
  `;
  const count = Number(rows[0]?.count ?? 1);

  if (Math.random() < 0.02) {
    void db.rateLimitBucket
      .deleteMany({ where: { windowStart: { lt: new Date(now - 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }

  const retryAfterSec = Math.ceil((windowStart.getTime() + windowMs - now) / 1000);
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec };
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export function clientIpHash(headers: Headers): string | null {
  return hashIp(getClientIp(headers));
}
