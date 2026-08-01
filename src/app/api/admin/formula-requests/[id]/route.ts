import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const { status, adminNote } = await req.json();

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
    },
    select: { userId: true, status: true },
  });

  // Supportive notification on a decision. Deliberately makes no promise of
  // supply, even on approval ("follow up about next steps").
  if (status === "APPROVED" || status === "DECLINED") {
    const message = status === "APPROVED"
      ? "We've reviewed your formula support request and will follow up with you about next steps."
      : "Thank you for your formula support request. We're not able to help with it right now, but please reach out again if your situation changes.";
    prisma.notification.create({
      data: { userId: updated.userId, type: "BUNDLE_UPDATE", message, link: "/bundles" },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
