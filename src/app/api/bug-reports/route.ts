import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { sendBugReportNotification } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`bug-report:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many reports. Please wait ${Math.ceil((rl.retryAfter ?? 3600) / 60)} minutes before trying again.` },
      { status: 429 }
    );
  }

  // Optional auth
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;

  let userRecord: { id: string; name: string; email: string | null } | null = null;
  if (auth) {
    userRecord = await prisma.user.findUnique({
      where:  { id: auth.userId },
      select: { id: true, name: true, email: true },
    });
  }

  const body = await req.json().catch(() => ({}));
  const { description, pageUrl, email, screenshotUrl } = body;

  const desc = typeof description === "string" ? description.trim() : "";
  if (desc.length < 10 || desc.length > 2000) {
    return NextResponse.json(
      { error: "Description must be between 10 and 2000 characters." },
      { status: 400 }
    );
  }

  const emailStr = typeof email === "string" ? email.trim().toLowerCase() : null;
  if (!userRecord && !emailStr) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  if (emailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") ?? null;
  const pageUrlStr = typeof pageUrl === "string" && pageUrl.trim() ? pageUrl.trim() : null;
  const screenshotStr = typeof screenshotUrl === "string" && screenshotUrl.trim() ? screenshotUrl.trim() : null;

  const report = await prisma.bugReport.create({
    data: {
      userId:       userRecord?.id ?? null,
      email:        emailStr || userRecord?.email || null,
      description:  desc,
      pageUrl:      pageUrlStr,
      userAgent,
      screenshotUrl: screenshotStr,
    },
  });

  // Fire-and-forget admin email
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sahw-care.vercel.app";
  const submittedBy = userRecord
    ? `${userRecord.name}${userRecord.email ? ` <${userRecord.email}>` : ""}`
    : `Anonymous${emailStr ? ` <${emailStr}>` : ""}`;

  sendBugReportNotification({
    reportId:     report.id,
    description:  desc,
    pageUrl:      pageUrlStr,
    userAgent,
    screenshotUrl: screenshotStr,
    submittedBy,
    submittedAt:  report.createdAt,
    baseUrl,
  }).catch((err) => console.error("[BugReport] Email failed:", err));

  return NextResponse.json({
    ok:      true,
    message: "Thanks for letting us know. We'll look into this as soon as possible.",
  });
}
