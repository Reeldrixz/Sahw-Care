import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CONFIRMATION_WINDOW_DAYS = 14;
const VALID_FORMS = ["Powder", "Ready-to-feed", "Concentrate"];

// D/F3c: minimal admin fix for a flagged correction. Only AWAITING_CONFIRMATION
// episodes are editable here. Any spec change resets the confirmation window and
// the reminder timestamps, clears the correction flag, and re-notifies the
// mother to take another look. (Mid-episode stage-for-growth on ACTIVE episodes
// is a separate D/F4 flow.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id },
    select: { id: true, userId: true, status: true, formulaBrand: true, formulaType: true, formulaStage: true, formulaForm: true },
  });
  if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  if (episode.status !== "AWAITING_CONFIRMATION") {
    return NextResponse.json({ error: "Only an episode awaiting confirmation can be edited here." }, { status: 409 });
  }

  const next: Record<string, string> = {};
  for (const k of ["formulaBrand", "formulaType", "formulaStage"] as const) {
    if (typeof body[k] === "string" && body[k].trim()) next[k] = body[k].trim();
  }
  if (typeof body.formulaForm === "string" && body.formulaForm.trim()) {
    if (!VALID_FORMS.includes(body.formulaForm.trim())) {
      return NextResponse.json({ error: "Invalid formula form." }, { status: 400 });
    }
    next.formulaForm = body.formulaForm.trim();
  }
  const adminNotes = typeof body.adminNotes === "string" && body.adminNotes.trim() ? body.adminNotes.trim() : undefined;

  // Did the actual product spec change?
  const specChanged =
    (next.formulaBrand !== undefined && next.formulaBrand !== episode.formulaBrand) ||
    (next.formulaType  !== undefined && next.formulaType  !== episode.formulaType)  ||
    (next.formulaStage !== undefined && next.formulaStage !== episode.formulaStage) ||
    (next.formulaForm  !== undefined && next.formulaForm  !== episode.formulaForm);

  const now      = new Date();
  const deadline = new Date(now.getTime() + CONFIRMATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  await prisma.formulaEpisode.update({
    where: { id: episode.id },
    data: {
      ...next,
      ...(adminNotes !== undefined && { adminNotes }),
      // On a real spec change, reset the clock for a clean re-confirmation.
      ...(specChanged && {
        confirmationDeadline:  deadline,
        correctionNote:        null,
        correctionRequestedAt: null,
        reminder7SentAt:       null,
        reminder12SentAt:      null,
      }),
    },
  });

  if (specChanged) {
    prisma.notification.create({
      data: {
        userId:  episode.userId,
        type:    "BUNDLE_UPDATE",
        message: "We've updated your formula details. Please take another look and confirm that everything matches what your baby uses.",
        link:    "/bundles/formula-support",
      },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, specChanged });
}
