import { NextRequest, NextResponse } from "next/server";
import { dailyAbuseCheck } from "@/lib/abuseJobs";

import { isAuthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await dailyAbuseCheck();
  return NextResponse.json({ ok: true, ...result });
}
export { GET as POST };
