import { NextRequest, NextResponse } from "next/server";
import { dailyAbuseCheck } from "@/lib/abuseJobs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await dailyAbuseCheck();
  return NextResponse.json({ ok: true, ...result });
}
