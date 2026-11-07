import { headers } from "next/headers";

interface Bucket {
  count: number;
  resetAt: number;
}

const globalForRateLimit = globalThis as unknown as {
  __axoraRateLimits?: Map<string, Bucket>;
};

function buckets(): Map<string, Bucket> {
  if (!globalForRateLimit.__axoraRateLimits) {
    globalForRateLimit.__axoraRateLimits = new Map();
  }
  return globalForRateLimit.__axoraRateLimits;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window in-memory limiter. Protects the login endpoint in this
 * deployment. For multi-instance production, back this with a shared store
 * (Upstash Redis or a Postgres table) — see README.
 */
export function rateLimit(
  key: string,
  limit = 5,
  windowMs = 60_000,
): RateLimitResult {
  const store = buckets();
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

export function resetRateLimit(key: string) {
  buckets().delete(key);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
