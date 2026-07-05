// Rate limiting: distributed (Upstash Redis) when configured, else in-memory.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface Entry {
  count:   number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Prune expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Returns { ok: true } if under limit, { ok: false, retryAfter } if exceeded.
 * @param key        Unique bucket key (e.g. "login:1.2.3.4")
 * @param max        Max requests allowed in the window
 * @param windowMs   Window duration in milliseconds
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: boolean; retryAfter?: number } {
  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, retryAfter };
  }

  entry.count += 1;
  return { ok: true };
}

// ── Distributed rate limiting (Upstash) ─────────────────────────────────────
// Falls back to the in-memory limiter above when Upstash env vars are absent
// (local dev / unconfigured deploys) or if a Redis call fails, so a Redis
// outage degrades to per-instance limiting rather than locking users out.

const upstashConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = upstashConfigured ? Redis.fromEnv() : null;

// One Ratelimit instance per (max, window) combo; the per-caller bucket key is
// passed to .limit().
const limiters = new Map<string, Ratelimit>();

function getLimiter(max: number, windowMs: number): Ratelimit {
  const cacheKey = `${max}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.fixedWindow(max, `${windowMs} ms`),
      prefix: "rl",
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

export async function rateLimitAsync(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfter?: number }> {
  if (!redis) return rateLimit(key, max, windowMs); // in-memory fallback
  try {
    const res = await getLimiter(max, windowMs).limit(key);
    if (res.success) return { ok: true };
    const retryAfter = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    return { ok: false, retryAfter };
  } catch {
    // Redis unreachable — degrade to in-memory rather than failing the request.
    return rateLimit(key, max, windowMs);
  }
}

export function getClientIp(req: Request): string {
  const fwd = (req as Request & { headers: Headers }).headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = (req as Request & { headers: Headers }).headers.get("x-real-ip");
  return real ?? "unknown";
}
