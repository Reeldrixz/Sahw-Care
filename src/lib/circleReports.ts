import type { Prisma } from "@prisma/client";

export type ReportOutcome =
  | "duplicate"   // she had already reported this post: counts once, nothing changes
  | "queued"      // first report: hidden, into the admin queue
  | "requeued"    // was APPROVED, she had never reported it: hidden, back in the queue
  | "added";      // already PENDING: her report is added to the list

// Record a mother's report on a circle post and apply the review rules. Run
// inside a transaction; the caller has already checked she may write in the
// post's circle, that it is not her own post, and her rate limit.
//
// - The same mother reporting the same post again counts once — whatever its
//   review state, including after an admin approved it.
// - A first report hides the post and queues it (FlaggedPost PENDING).
// - An APPROVED post is re-queued only by a mother who has never reported it,
//   so one person cannot keep pulling down a post an admin has cleared.
// - Reports never touch the author's account.
export async function applyCircleReport(
  tx: Prisma.TransactionClient,
  postId: string,
  reporterId: string,
  reason: string,
): Promise<ReportOutcome> {
  const already = await tx.postReport.findUnique({
    where:  { postId_reportedBy: { postId, reportedBy: reporterId } },
    select: { id: true },
  });
  if (already) return "duplicate";

  await tx.postReport.create({ data: { postId, reportedBy: reporterId, reason } });

  const flag = await tx.flaggedPost.findUnique({ where: { postId }, select: { status: true } });
  const queueReason = `Reported by a mother: "${reason.slice(0, 200)}"`;

  let outcome: ReportOutcome;
  if (!flag) {
    // upsert, not create, so two mothers reporting at the same moment cannot
    // collide on the unique postId.
    await tx.flaggedPost.upsert({
      where:  { postId },
      create: { postId, reason: queueReason },
      update: {},
    });
    outcome = "queued";
  } else if (flag.status === "APPROVED") {
    await tx.flaggedPost.update({
      where: { postId },
      data:  { status: "PENDING", reviewedAt: null, reason: queueReason },
    });
    outcome = "requeued";
  } else {
    outcome = "added";
  }

  await tx.circlePost.update({ where: { id: postId }, data: { isHidden: true } });
  return outcome;
}
