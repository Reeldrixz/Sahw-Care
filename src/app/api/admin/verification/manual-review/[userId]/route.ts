import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_REJECT =
  "We weren't able to verify your profile this time. Please make sure your contact details are verified and your profile photo is clear, then resubmit whenever you're ready. 💛";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const { action, reason } = await req.json(); // action: "approve" | "reject"

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  const now = new Date();

  if (action === "approve") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        manualReviewStatus:         "APPROVED",
        manualReviewedAt:           now,
        manualReviewedByAdminId:    admin.userId,
        manualReviewRejectionReason: null,
      },
    });

    await prisma.notification.create({
      data: {
        userId:  userId,
        type:    "MANUAL_REVIEW_APPROVED",
        // Says what verification actually does, and nothing more.
        //
        // This previously read "You can now access care support through
        // Kradel." That was false for every user it was ever sent to:
        // verification sets manualReviewStatus and never touches role, and
        // care support requires the RECIPIENT role, which is granted only
        // through a referral. Mothers were being told a door was open that
        // was not, and then hitting the partner-directory wall with no idea
        // why. Promising access is the one thing this message must not do.
        message:
          "Your profile has been verified. 💛 Thank you for your patience. " +
          "If you're looking for care support, that comes through one of our partner " +
          "organisations — you can find them under Find help.",
        link:    "/find-help",
      },
    });
  } else {
    const rejectionReason = reason?.trim() || DEFAULT_REJECT;

    await prisma.user.update({
      where: { id: userId },
      data: {
        manualReviewStatus:          "REJECTED",
        manualReviewedAt:            now,
        manualReviewedByAdminId:     admin.userId,
        manualReviewRejectionReason: rejectionReason,
      },
    });

    await prisma.notification.create({
      data: {
        userId:  userId,
        type:    "MANUAL_REVIEW_REJECTED",
        message: rejectionReason,
        link:    "/profile",
      },
    });
  }

  return NextResponse.json({ ok: true, action });
}
