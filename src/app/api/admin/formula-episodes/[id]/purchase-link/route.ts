import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePurchaseUrl } from "@/lib/purchaseLink";

export const dynamic = "force-dynamic";

// F2: set or CORRECT the episode's purchasing link.
//
// Setting a link ALWAYS starts a clean confirmation round: confirmed / sent /
// declined / reminder / escalation state is wiped, so a corrected link can never
// inherit the old link's confirmation. That is the core safety property — a
// known-wrong link must never remain purchasable, so unlike a stage bump this
// invalidates immediately rather than parking the new link in pendingPurchaseUrl.
//
// No notification fires here: the admin may set, eyeball, and correct a link
// several times before sending. She is only contacted by the separate /approve.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const validated = validatePurchaseUrl(body.purchaseUrl);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id },
    select: { id: true, status: true, pendingFormulaStage: true },
  });
  if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  if (episode.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only an active episode's purchase link can be set." }, { status: 409 });
  }
  // One product question to her at a time. A live stage proposal already carries
  // its own product ask (F5's combined stage + link card), so a separate link
  // correction here would put two conflicting questions in front of her.
  if (episode.pendingFormulaStage) {
    return NextResponse.json({
      error: "A stage change is waiting on her confirmation. Resolve that first — the new stage's link is part of that same ask.",
      code:  "PENDING_STAGE_CHANGE",
    }, { status: 409 });
  }

  await prisma.formulaEpisode.update({
    where: { id: episode.id },
    data:  {
      purchaseUrl:             validated.url,
      purchaseUrlSetAt:        new Date(),
      purchaseUrlSetByAdminId: admin.userId,
      // Clean round — the new link is unconfirmed and unpurchasable until she says so.
      purchaseUrlConfirmedAt:    null,
      purchaseUrlSentAt:         null,
      purchaseUrlDeclinedAt:     null,
      purchaseUrlDeclineNote:    null,
      purchaseUrlReminderCount:  0,
      purchaseUrlReminderSentAt: null,
      blockedAdminNotifiedAt:    null,
      blockedAdminEscalatedAt:   null,
    },
  });

  return NextResponse.json({ ok: true, purchaseUrl: validated.url });
}
