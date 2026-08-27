import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAGE_META, type StageKey } from "@/lib/stage";

export const dynamic = "force-dynamic";

// Her own Experiences — drafts sent back to her, plus anything awaiting review.
//
// Deliberately NOT gated on canWriteExperiences. A mother who has turned the
// motherhood flag off, or whose account is on hold, must still be able to see
// and open what she already wrote. The write gate stops NEW content; it should
// never lock her out of her own words.
//
// Scoped to authorId on the server. There is no id parameter and no way to ask
// for someone else's — the query cannot express it.
export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.experience.findMany({
    where: { authorId: auth.userId, status: { in: ["DRAFT", "PENDING"] } },
    // Drafts first: those are the ones waiting on her.
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      situation: true,
      whatITried: true,
      takeaway: true,
      topic: true,
      stageKey: true,
      status: true,
      updatedAt: true,
      // The send-back note — what one change would let it through. This is the
      // author-facing text only; reviewNote is internal and is never selected
      // here, so it cannot reach her through this route.
      rejectionReasonForAuthor: true,
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      stageLabel: r.stageKey ? STAGE_META[r.stageKey as StageKey]?.label ?? r.stageKey : null,
    })),
  });
}
