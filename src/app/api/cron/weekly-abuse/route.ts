import { NextRequest, NextResponse } from "next/server";
import { weeklyAbuseSummary } from "@/lib/abuseJobs";

import { isAuthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await weeklyAbuseSummary();
  return NextResponse.json({ ok: true });
}
export { GET as POST };
