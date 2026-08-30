import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  publishedLink,
} from "@/lib/experienceSafety";
import { checkExperienceSafety, checkCommentSafety, type AiCheckResult } from "@/lib/experienceSafetyCheck";

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
//
// AI_FLAGGED is decidable by ALL FOUR actions, not just approve. The whole point
// of the second look is that it may change the reviewer's mind — seeing the
// flagged passage can rightly turn an approve into a decline, a send-back, or a
// hold. Restricting it to confirm-or-nothing would waste the second look.
const DECIDABLE: string[] = ["PENDING", "AI_FLAGGED"];

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

  const now = new Date();

  // ── Load the target first ────────────────────────────────────────────────
  // Needed before the gate runs: the AI is given the post's own text, and the
  // gate must only run on a first approve (PENDING), never on the confirming
  // second click from AI_FLAGGED.
  const model = isComment ? prisma.experienceComment : prisma.experience;

  // Fetched into two separately typed variables rather than one union: only the
  // post shape carries the three text fields the gate needs, and narrowing a
  // union of two selects costs more than it saves.
  const commentTarget = isComment
    ? await prisma.experienceComment.findUnique({
        where:  { id },
        select: {
          id: true, authorId: true, status: true, body: true,
          // The parent is fetched as CONTEXT for the AI check only. A comment
          // cannot be judged without knowing what it replies to.
          experience: { select: { situation: true, whatITried: true, takeaway: true, aiVerdict: true } },
        },
      })
    : null;

  const post = isComment
    ? null
    : await prisma.experience.findUnique({
        where:  { id },
        select: {
          id: true, authorId: true, status: true,
          situation: true, whatITried: true, takeaway: true,
        },
      });

  const target = commentTarget ?? post;
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── AI final gate ────────────────────────────────────────────────────────
  // Runs ONLY here, inside approve, after the human has decided. It is a second
  // independent check on the publish path, never a reviewer of her work and
  // never a decision-maker: it can stop a publish for one more human look, or
  // let an approved post through. decline/send_back/hold never reach this code,
  // so it can never see or act on something a human declined.
  //
  // It does NOT re-run on the confirming second click. Re-checking would flag
  // the same passage again and loop forever; the second click IS the decision.
  //
  // Fail-open: UNAVAILABLE publishes anyway and records that the gate did not
  // run. The human is the primary gate and has already approved, so this
  // degrades to exactly today's human-only safety — while failing closed would
  // let one missing key silently freeze every mother's post.
  // Posts and comments both. A comment carries the same hazard class — "just do
  // what I said above" inherits whatever is above it — and is the easier place
  // to slip something past a tired reviewer precisely because it is short.
  let aiResult: AiCheckResult | null = null;
  if (action === "approve" && target.status === "PENDING") {
    if (post) {
      aiResult = await checkExperienceSafety(post);
    } else if (commentTarget?.experience) {
      aiResult = await checkCommentSafety(
        commentTarget.body,
        commentTarget.experience,
        commentTarget.experience.aiVerdict,
      );
    }
  }

  const aiBlocked = aiResult?.verdict === "FLAG";

  const nextStatus =
    action === "approve"   ? (aiBlocked ? "AI_FLAGGED" : "PUBLISHED")
    : action === "decline" ? "REJECTED"
    : action === "send_back" ? "DRAFT"
    : "HELD_FOR_SUPPORT";

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
    // Only a real publish stamps publishedAt — an AI-flagged post is not
    // published, so it must not look published in the data.
    publishedAt: action === "approve" && !aiBlocked ? now : null,

    // The AI verdict is stored on posts whenever the gate ran, including
    // UNAVAILABLE. A gate that stopped running has to be visible in the record,
    // not inferred from a missing value.
    ...(aiResult && {
      aiCheckedAt: now,
      aiVerdict:   aiResult.verdict,
      aiNote:      aiResult.note || null,
      // Cast: AiFlag[] is structurally valid JSON, but Prisma's InputJsonValue
      // does not accept a typed interface array without it.
      aiFlags: aiResult.flags.length
        ? (aiResult.flags as unknown as Prisma.InputJsonValue)
        : undefined,
    }),

    // Publishing over a flag: the second, deliberate click. Recorded because a
    // human overriding an AI safety flag on baby content is a decision worth
    // being able to look up later.
    ...(action === "approve" && target.status === "AI_FLAGGED" && {
      aiConfirmedByAdminId: admin.userId,
      aiConfirmedAt:        now,
    }),
  };

  // ── Conditional transition: exactly once ─────────────────────────────────
  const { count } = await (model as typeof prisma.experience).updateMany({
    where: { id, status: { in: DECIDABLE as never } },
    data,
  });

  if (count === 0) {
    return NextResponse.json(
      {
        error: "Already decided",
        detail: `This ${isComment ? "comment" : "experience"} is ${target.status}; only PENDING or AI_FLAGGED items can be decided.`,
        status: target.status,
      },
      { status: 409 }
    );
  }

  // ── AI blocked the publish: stop here, tell nobody but the reviewer ───────
  // She is deliberately NOT notified. Nothing has happened from her side — her
  // post is still under review, and being told "an AI flagged your writing"
  // would be both alarming and untrue, since no decision about it has been made.
  // The AI never contacts her; only a terminal human decision does.
  if (aiBlocked) {
    return NextResponse.json({
      ok: true,
      status: "AI_FLAGGED",
      aiBlocked: true,
      aiNote:  aiResult?.note ?? "",
      aiFlags: aiResult?.flags ?? [],
    });
  }

  // ── Tell her ─────────────────────────────────────────────────────────────
  // A send-back links straight into the editor with the draft loaded. The
  // message promises "edit it whenever you're ready and send it back to us" —
  // without this, that sentence has nowhere to go, and a send-back becomes a
  // decline wearing kinder words.
  //
  // An approval links to the published experience itself, now that the reader
  // exists. Comments have no page of their own yet, so they still carry none —
  // a link to a 404 is worse than no link.
  const link =
    action === "send_back" && !isComment
      ? `/experiences/new?draft=${id}`
      : action === "approve" && !isComment
        ? publishedLink(id)
        : undefined;

  const result = await notifyUser({
    userId: target.authorId,
    type: "ADMIN_MESSAGE",
    message: messageForAuthor,
    ...(link && { link }),
    context: `experiences:${action}`,
  });

  return NextResponse.json({
    ok: true,
    status: nextStatus,
    // Surfaced so a publish that happened without the gate running is visible
    // to the reviewer at the moment it happens, not only in the record.
    ...(aiResult?.verdict === "UNAVAILABLE" && {
      aiUnavailable: true,
      aiNote: aiResult.note,
    }),
    // Surfaced so the queue can flag a mother who received nothing at all.
    // Most important on the crisis path: an unreceived crisis message is the
    // entire failure, and it must not pass silently.
    notified: result.reached,
    ...(action === "hold_for_support" && !result.reached
      ? { warning: "She was NOT reached. Contact her directly — the crisis message did not deliver." }
      : {}),
  });
}
