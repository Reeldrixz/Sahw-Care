import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import {
  CRISIS_SUPPORT_MESSAGE,
  PUBLISHED_MESSAGE,
  COMMENT_PUBLISHED_MESSAGE,
  SEND_BACK_NOTE_MIN_LENGTH,
  declineMessageFor,
  isSafetyCategoryCode,
  sendBackMessage,
} from "@/lib/experienceSafety";

export const dynamic = "force-dynamic";

// Manual admin decision on one Experience post or comment. No auto-anything:
// every item reaches a human, and the human's choice is the only thing that
// moves it. Four actions:
//
//   approve          -> PUBLISHED
//   decline          -> REJECTED, with fixed per-category copy she can read
//   send_back        -> DRAFT, with a specific note saying what one change
//                       would let it through (posts only — comments have
//                       nothing to redraft into)
//   hold_for_support -> HELD_FOR_SUPPORT, the crisis path. NOT a rejection.
//                       She gets the crisis support message and no verdict on
//                       her writing at all.
//
// Exactly-once: every transition is a conditional updateMany gated on the
// status the item must currently be in. Two admins clicking approve on the same
// post produce one publish and one "already decided" — the second cannot double
// notify her, and cannot overwrite the first decision's audit fields.
//
// Notifications go through notifyUser, which awaits and never throws. Its
// `reached` flag is returned to the admin, so a mother who received nothing at
// all is visible in the queue rather than silently lost. That matters most on
// the crisis path, where an unreceived message is the whole failure.

type Action = "approve" | "decline" | "send_back" | "hold_for_support";
const ACTIONS: Action[] = ["approve", "decline", "send_back", "hold_for_support"];

// Only items awaiting a decision can be decided. DRAFT is excluded on purpose:
// a sent-back post is hers again, and the queue should not be able to reach
// back in and publish or decline it behind her.
const DECIDABLE: string[] = ["PENDING"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { action, kind, safetyCategory, reviewNote, sendBackNote } = body ?? {};

  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }
  const isComment = kind === "comment";

  if (isComment && action === "send_back") {
    return NextResponse.json(
      { error: "Comments cannot be sent back to draft — approve, decline, or hold instead." },
      { status: 400 }
    );
  }

  // ── Validate the action's own inputs before touching anything ────────────
  let messageForAuthor: string;

  if (action === "approve") {
    messageForAuthor = isComment ? COMMENT_PUBLISHED_MESSAGE : PUBLISHED_MESSAGE;
  } else if (action === "decline") {
    if (!isSafetyCategoryCode(safetyCategory)) {
      return NextResponse.json(
        { error: "decline requires a valid safetyCategory." },
        { status: 400 }
      );
    }
    messageForAuthor = declineMessageFor(safetyCategory);
  } else if (action === "send_back") {
    const note = typeof sendBackNote === "string" ? sendBackNote.trim() : "";
    if (note.length < SEND_BACK_NOTE_MIN_LENGTH) {
      return NextResponse.json(
        {
          error:
            `Say specifically what to change — at least ${SEND_BACK_NOTE_MIN_LENGTH} characters. ` +
            `A vague send-back leaves her knowing something is wrong but not what.`,
        },
        { status: 400 }
      );
    }
    messageForAuthor = sendBackMessage(note);
  } else {
    messageForAuthor = CRISIS_SUPPORT_MESSAGE;
  }

  const nextStatus =
    action === "approve"   ? "PUBLISHED"
    : action === "decline" ? "REJECTED"
    : action === "send_back" ? "DRAFT"
    : "HELD_FOR_SUPPORT";

  const now = new Date();

  // reviewNote is INTERNAL and never rendered to the author. It is stored apart
  // from rejectionReasonForAuthor for exactly that reason.
  const internalNote =
    typeof reviewNote === "string" && reviewNote.trim()
      ? reviewNote.trim().slice(0, 1000)
      : null;

  // rejectionReasonForAuthor holds the copy she actually received, so the queue
  // records what was sent rather than only which button was pressed. Approve
  // clears it, so a re-approved item carries no stale decline text.
  const authorFacing = action === "approve" ? null : messageForAuthor;

  const data = {
    status: nextStatus as never,
    reviewedById: admin.userId,
    reviewedAt: now,
    reviewNote: internalNote,
    rejectionReasonForAuthor: authorFacing,
    publishedAt: action === "approve" ? now : null,
  };

  // ── Conditional transition: exactly once ─────────────────────────────────
  const model = isComment ? prisma.experienceComment : prisma.experience;

  const target = await (model as typeof prisma.experience).findUnique({
    where: { id },
    select: { id: true, authorId: true, status: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { count } = await (model as typeof prisma.experience).updateMany({
    where: { id, status: { in: DECIDABLE as never } },
    data,
  });

  if (count === 0) {
    return NextResponse.json(
      {
        error: "Already decided",
        detail: `This ${isComment ? "comment" : "experience"} is ${target.status}; only PENDING items can be decided.`,
        status: target.status,
      },
      { status: 409 }
    );
  }

  // ── Tell her ─────────────────────────────────────────────────────────────
  // No link on approval until E3 ships the reader — a notification pointing at
  // a 404 is worse than one that simply carries the good news.
  const result = await notifyUser({
    userId: target.authorId,
    type: "ADMIN_MESSAGE",
    message: messageForAuthor,
    context: `experiences:${action}`,
  });

  return NextResponse.json({
    ok: true,
    status: nextStatus,
    // Surfaced so the queue can flag a mother who received nothing at all.
    // Most important on the crisis path: an unreceived crisis message is the
    // entire failure, and it must not pass silently.
    notified: result.reached,
    ...(action === "hold_for_support" && !result.reached
      ? { warning: "She was NOT reached. Contact her directly — the crisis message did not deliver." }
      : {}),
  });
}
