// In-memory rate limiter. Resets on cold starts — replace with Redis for multi-instance scale.

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

export function getClientIp(req: Request): string {
  const fwd = (req as Request & { headers: Headers }).headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = (req as Request & { headers: Headers }).headers.get("x-real-ip");
  return real ?? "unknown";
}
