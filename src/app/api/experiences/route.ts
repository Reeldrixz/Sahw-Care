import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canWriteExperiences } from "@/lib/access";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { STAGE_META, type StageKey } from "@/lib/stage";
import {
  EXPERIENCE_FIELDS,
  validateExperienceField,
} from "@/lib/experienceSafety";
import { ExperienceTopic } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_STAGES = new Set(Object.keys(STAGE_META));
const VALID_TOPICS = new Set(Object.values(ExperienceTopic) as string[]);

// Authoring for Experiences.
//
//   POST  — write a new experience. Always lands PENDING, never PUBLISHED.
//   PATCH — resubmit a DRAFT she was sent back. Also lands PENDING.
//
// Eligibility is canWriteExperiences and nothing else: motherhood, plus no
// account hold. Deliberately NOT gated on role — a donor who is a mother is
// eligible, which was the entire point of E1. Reflections gates on
// role === "RECIPIENT" and copying that here would quietly undo it.
//
// The three required fields are the structural guardrail. With situation and
// takeaway both required at a real minimum length, a check-in cannot become a
// post — there is nowhere for "just checking in" to go. That is enforced here,
// on the server, not only in the form.

/** Shared shape-checking for both create and resubmit. */
function readAndValidate(body: unknown): { data: Record<string, string>; stageKey: string | null; topic: string } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  const data: Record<string, string> = {};
  for (const f of EXPERIENCE_FIELDS) {
    const err = validateExperienceField(f.key, b[f.key]);
    if (err) return { error: err };
    data[f.key] = String(b[f.key]).trim();
  }

  const topic = typeof b.topic === "string" ? b.topic : "";
  if (!VALID_TOPICS.has(topic)) {
    return { error: "Please choose a topic so other mothers can find this." };
  }

  // Stage is the stage the experience is ABOUT, chosen by her — not a snapshot
  // of where she stands now. Experiences is retrospective: a mother at 13-24
  // months writing about a 6-week bottle refusal is writing for postpartum-0-3,
  // and snapshotting her current stage would mis-file precisely the posts that
  // are most useful to retrieve. Optional, because some knowledge is not
  // stage-bound at all.
  const rawStage = typeof b.stageKey === "string" ? b.stageKey.trim() : "";
  if (rawStage && !VALID_STAGES.has(rawStage)) {
    return { error: "That stage isn't one we recognise." };
  }

  return { data, stageKey: rawStage || null, topic };
}

async function requireAuthor(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const me = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { isMother: true, accountHold: true },
  });
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const gate = canWriteExperiences(me);
  if (!gate.allowed) {
    return { error: NextResponse.json({ error: gate.message, code: gate.code }, { status: 403 }) };
  }
  return { userId: auth.userId };
}

// ── POST: write a new experience ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const who = await requireAuthor(req);
  if ("error" in who) return who.error;

  // Rate limits mirror Reflections: a handful a day per account, plus an IP
  // guard. Generous enough that a mother writing several in one sitting is
  // never blocked, tight enough that the review queue cannot be flooded.
  const rl = rateLimit(`experience-submit:${who.userId}`, 5, 24 * 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You've written a few today already. Come back a little later to add more — there's no rush." },
      { status: 429 }
    );
  }
  const ipRl = rateLimit(`experience-submit-ip:${getClientIp(req)}`, 20, 24 * 60 * 60 * 1000);
  if (!ipRl.ok) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  const parsed = readAndValidate(await req.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const created = await prisma.experience.create({
    data: {
      authorId:   who.userId,
      situation:  parsed.data.situation,
      whatITried: parsed.data.whatITried,
      takeaway:   parsed.data.takeaway,
      topic:      parsed.topic as ExperienceTopic,
      stageKey:   parsed.stageKey,
      status:     "PENDING", // never PUBLISHED from here; only E4's queue publishes
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id, status: "PENDING" }, { status: 201 });
}

// ── PATCH: resubmit a draft that was sent back ──────────────────────────────
// Closes the loop E4's send-back copy promises: "edit it whenever you're ready
// and send it back to us." Only DRAFT moves, only her own, and the transition
// is a conditional updateMany so a double-submit cannot re-enter the queue
// twice.
export async function PATCH(req: NextRequest) {
  const who = await requireAuthor(req);
  if ("error" in who) return who.error;

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const parsed = readAndValidate(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { count } = await prisma.experience.updateMany({
    // authorId in the WHERE, not checked after the fact: this is what stops one
    // mother editing another's draft, and it cannot be forgotten downstream.
    where: { id, authorId: who.userId, status: "DRAFT" },
    data: {
      situation:  parsed.data.situation,
      whatITried: parsed.data.whatITried,
      takeaway:   parsed.data.takeaway,
      topic:      parsed.topic as ExperienceTopic,
      stageKey:   parsed.stageKey,
      status:     "PENDING",
      // Clear the previous round's review so the queue shows it fresh and she
      // is never re-shown an old send-back note against new text.
      reviewedById:             null,
      reviewedAt:               null,
      reviewNote:               null,
      rejectionReasonForAuthor: null,
    },
  });

  if (count === 0) {
    return NextResponse.json(
      { error: "That draft isn't available to edit — it may already be back with the team." },
      { status: 409 }
    );
  }

  return NextResponse.json({ id, status: "PENDING" });
}
