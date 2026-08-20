import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// D/F3c: the mother flags that the product details aren't right. The episode
// STAYS AWAITING_CONFIRMATION (no activation, no deliveries). An admin fixes the
// spec, which resets the confirmation window, and she re-confirms.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { episodeId } = await params;
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) {
    return NextResponse.json({ error: "Please tell us what needs to change." }, { status: 400 });
  }

  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id: episodeId },
    select: { id: true, userId: true, status: true },
  });
  if (!episode || episode.userId !== currentUser.userId) {
    return NextResponse.json({ error: "Formula episode not found" }, { status: 404 });
  }
  if (episode.status !== "AWAITING_CONFIRMATION") {
    return NextResponse.json({ error: "This formula support is no longer awaiting confirmation." }, { status: 409 });
  }

  await prisma.formulaEpisode.update({
    where: { id: episode.id },
    data:  { correctionNote: note.slice(0, 500), correctionRequestedAt: new Date() },
  });

  // Alert all admins to review and fix the spec.
  prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }).then((admins) => {
    if (admins.length === 0) return;
    return prisma.notification.createMany({
      data: admins.map((a) => ({
        userId:  a.id,
        type:    "ADMIN_MESSAGE" as const,
        title:   "Formula correction flagged",
        message: `${currentUser.name ?? "A mother"} flagged a correction on her formula details. Please review and update.`,
        link:    "/admin",
      })),
    });
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
