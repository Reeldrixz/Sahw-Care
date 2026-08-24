import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { monthlyCooldown, formatCooldownDate } from "@/lib/cooldowns";

export const dynamic = "force-dynamic";

// Manual decision on a formula support request. No auto-fulfilment: this only
// records a human's PENDING/APPROVED/DECLINED call and (optionally) a note.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { status, adminNote, declineReasonForMother } = await req.json();

  // Mother-facing reason, kept strictly separate from the internal adminNote:
  // whatever lands here is sent to her word-for-word.
  const sharedReason = typeof declineReasonForMother === "string" && declineReasonForMother.trim()
    ? declineReasonForMother.trim().slice(0, 300)
    : null;

  const valid = ["PENDING", "APPROVED", "DECLINED"];
  if (status && !valid.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Belt-and-suspenders monthly cooldown: don't let an admin approve a second
  // formula allocation for the same mother within a month of a prior approval.
  // Independent of the bundle clock (queries FormulaRequest only).
  if (status === "APPROVED") {
    const target = await prisma.formulaRequest.findUnique({
      where:  { id },
      select: { userId: true },
    });
    if (target?.userId) {
      const priorApproved = await prisma.formulaRequest.findFirst({
        where:   { userId: target.userId, status: "APPROVED", id: { not: id } },
        orderBy: { reviewedAt: "desc" },
        select:  { reviewedAt: true },
      });
      const cd = monthlyCooldown(priorApproved?.reviewedAt ?? null);
      if (cd.active && cd.lastApprovedAt && cd.nextEligibleAt) {
        return NextResponse.json({
          error: `This mother's formula support was approved on ${formatCooldownDate(cd.lastApprovedAt)}. Formula is provided about a month at a time, so she is next eligible from ${formatCooldownDate(cd.nextEligibleAt)}.`,
          code:  "FORMULA_MONTHLY_COOLDOWN",
        }, { status: 409 });
      }
    }
  }

  const updated = await prisma.formulaRequest.update({
    where: { id },
    data: {
      ...(status && { status, reviewedAt: new Date(), reviewedBy: admin.userId }),
      ...(adminNote !== undefined && { adminNote }),
      ...(status === "DECLINED" && { declineReasonForMother: sharedReason }),
    },
    select: { userId: true, status: true, user: { select: { name: true, email: true } } },
  });

  // Supportive notification on a decision. Deliberately makes no promise of
  // supply, even on approval ("follow up about next steps"). A decline is a
  // sensitive moment, so it stays warm and does NOT deflect her to other
  // programmes — just an honest note and an open door to apply again.
  if (status === "APPROVED" || status === "DECLINED") {
    const declineMessage = sharedReason
      ? `Thank you for your formula support request. We're not able to help with it right now. ${sharedReason} You're welcome to apply again if anything changes.`
      : "Thank you for your formula support request. We're not able to help with it right now, but your situation matters to us — please reach out or apply again if anything changes.";
    const message = status === "APPROVED"
      ? "We've reviewed your formula support request and will follow up with you about next steps."
      : declineMessage;

    // Tier-1: a dropped decision notice leaves her with no idea what happened.
    // Decline emails too — in-app alone meant a mother who doesn't open the app
    // was never told her request had been turned down.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sahw-care.vercel.app";
    const res = await notifyUser({
      userId:  updated.userId,
      type:    "BUNDLE_UPDATE",
      message,
      link:    "/bundles/formula-support",
      context: status === "DECLINED" ? "formula:decline" : "formula:approve-request",
      email: status === "DECLINED" ? {
        to:      updated.user.email,
        subject: "About your formula support request",
        html:    `<p>Hi ${updated.user.name},</p><p>${declineMessage}</p><p><a href="${appUrl}/bundles/formula-support">Formula support</a></p><p>With warmth,<br/>The Kradel Team</p>`,
      } : null,
    });
    return NextResponse.json({ ok: true, notified: res.reached });
  }

  return NextResponse.json({ ok: true, notified: true });
}
