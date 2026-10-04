import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canWriteInCircle } from "@/lib/circleAccess";
import { rateLimitAsync } from "@/lib/rateLimit";
import { applyCircleReport } from "@/lib/circleReports";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ postId: string }> };

// Reports per mother per hour. Generous for real use; a cap on one person
// clearing a circle by reporting everything in it.
const REPORTS_PER_HOUR = 10;

// Report a circle post.
//
// - Only a mother allowed to write in the post's circle (lib/circleAccess) may
//   report; anyone else gets 404, as on every circle route.
// - She cannot report her own post.
// - One report hides the post and puts it in the admin review queue
//   (FlaggedPost PENDING, Admin → Circles). Approving restores it and marks its
//   reports resolved; removing deletes it.
// - The same mother reporting the same post again counts once: nothing
//   changes, including on a post an admin has already approved.
// - An APPROVED post is re-queued only by a mother who has never reported it,
//   so one person cannot keep pulling down a post an admin has cleared.
// - Reports never change the author's account. The old rule flagged an account
//   after three reports across her posts, which let a few people suspend a
//   mother with no review; that is now an admin decision.
export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const { reason } = await req.json().catch(() => ({ reason: "" }));
  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }
  const trimmed = reason.trim().slice(0, 500);

  const post = await prisma.circlePost.findUnique({
    where:  { id: postId },
    select: { id: true, userId: true, circleId: true, isHidden: true },
  });
  // A hidden post is not visible to her, so it is not reportable either.
  if (!post || post.isHidden || !(await canWriteInCircle(auth.userId, post.circleId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (post.userId === auth.userId) {
    return NextResponse.json({ error: "You cannot report your own post" }, { status: 400 });
  }

  const rl = await rateLimitAsync(`circle-report:${auth.userId}`, REPORTS_PER_HOUR, 60 * 60 * 1000);
  if (!rl.ok) {
    const wait = rl.retryAfter ?? 60;
    return NextResponse.json(
      { error: `You've sent a lot of reports recently. Please try again in ${Math.ceil(wait / 60)} minutes.` },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  // The review rules live in lib/circleReports. The response is the same for
  // every outcome, so a reporter cannot tell whether her report changed anything.
  await prisma.$transaction((tx) => applyCircleReport(tx, postId, auth.userId, trimmed));

  return NextResponse.json({ reported: true });
}
