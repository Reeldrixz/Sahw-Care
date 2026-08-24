import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// D/F3c + D/F4c: list formula episodes for admin. Defaults to
// AWAITING_CONFIRMATION (so the admin can resolve flagged corrections); pass
// ?status=ACTIVE for the delivery-marking view, any FormulaEpisodeStatus, or
// ALL. Each episode carries its per-month deliveries (empty for AWAITING) so the
// ACTIVE view can render the month-by-month fulfilment rows.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "AWAITING_CONFIRMATION";

  const episodes = await prisma.formulaEpisode.findMany({
    where:   status !== "ALL" ? { status: status as never } : {},
    orderBy: { startedAt: "asc" },
    take:    100,
    include: {
      user:       { select: { id: true, name: true, email: true, phone: true } },
      deliveries: {
        orderBy: { monthIndex: "asc" },
        select:  {
          monthIndex:              true,
          status:                  true,
          scheduledFor:            true,
          fulfilledAt:             true,
          formulaStageAtFulfilment: true,
          note:                    true,
          purchasedAt:             true,
          purchaseUrlAtPurchase:   true,
        },
      },
    },
  });

  const data = episodes.map((e) => ({
    id:                    e.id,
    status:                e.status,
    formulaBrand:          e.formulaBrand,
    formulaType:           e.formulaType,
    formulaStage:          e.formulaStage,
    formulaForm:           e.formulaForm,
    monthsTotal:           e.monthsTotal,
    confirmationDeadline:  e.confirmationDeadline,
    correctionNote:        e.correctionNote,
    correctionRequestedAt: e.correctionRequestedAt,
    startedAt:             e.startedAt,
    confirmedAt:           e.confirmedAt,
    completedAt:           e.completedAt,
    pendingFormulaStage:     e.pendingFormulaStage,
    pendingStageRequestedAt: e.pendingStageRequestedAt,
    pendingPurchaseUrl:      e.pendingPurchaseUrl,
    // F4: purchasing-link state drives the admin button lifecycle and the
    // BLOCKED panel. purchaseUrlConfirmedAt is the safe-to-purchase signal.
    purchaseUrl:            e.purchaseUrl,
    purchaseUrlSetAt:       e.purchaseUrlSetAt,
    purchaseUrlSentAt:      e.purchaseUrlSentAt,
    purchaseUrlConfirmedAt: e.purchaseUrlConfirmedAt,
    purchaseUrlDeclinedAt:  e.purchaseUrlDeclinedAt,
    purchaseUrlDeclineNote: e.purchaseUrlDeclineNote,
    fulfilledCount:        e.deliveries.filter((d) => d.status === "FULFILLED").length,
    deliveries:            e.deliveries,
    mother: { id: e.user.id, name: e.user.name, email: e.user.email, phone: e.user.phone },
  }));

  return NextResponse.json({ episodes: data });
}
