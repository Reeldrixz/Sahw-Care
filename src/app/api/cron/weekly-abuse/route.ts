import { NextRequest, NextResponse } from "next/server";
import { weeklyAbuseSummary } from "@/lib/abuseJobs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await weeklyAbuseSummary();
  return NextResponse.json({ ok: true });
}
