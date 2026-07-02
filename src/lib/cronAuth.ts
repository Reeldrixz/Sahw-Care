import { NextRequest } from "next/server";

/**
 * Authenticates a cron invocation. Fail-closed: returns false unless CRON_SECRET
 * is set AND the request presents a matching secret.
 *
 * Accepts the secret via (in order):
 *  - `Authorization: Bearer <secret>`  (how Vercel Cron sends it when CRON_SECRET
 *    is configured on the project)
 *  - `x-cron-secret: <secret>`         (manual/legacy trigger)
 *  - `?secret=<secret>`                (manual/legacy trigger)
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail closed — no secret configured => reject

  const authz = req.headers.get("authorization");
  const bearer = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  const provided =
    bearer ??
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret");

  return provided === expected;
}
