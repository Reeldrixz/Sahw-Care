import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { checkReflection } from "@/lib/reflectionModeration";
import { STAGE_META, type StageKey } from "@/lib/stage";

export const dynamic = "force-dynamic";

const VALID_STAGES = new Set(Object.keys(STAGE_META));

// Peer-safe display name: chosen circle display name, else FIRST name only.
// NEVER exposes full name, email, or userId to peers.
function displayNameFor(u: { name: string; circleDisplayName: string | null }): string {
  if (u.circleDisplayName?.trim()) return u.circleDisplayName.trim();
  return u.name.split(" ")[0] || u.name;
}

// ── GET: published reflections for a stage (peer feed) ──────────────────────
// Any logged-in, non-donor mother may read (cross-stage browsing is allowed,
// read-only). Returns ONLY peer-safe fields.
export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { journeyType: true },
  });
  if (me?.journeyType === "donor") {
    return NextResponse.json({ error: "Reflections are only available for mothers." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage") ?? "";
  if (!VALID_STAGES.has(stage)) {
    return NextResponse.json({ error: "Unknown stage" }, { status: 400 });
  }

  const reflections = await prisma.reflection.findMany({
    where:   { stageKey: stage as StageKey, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take:    50,
    select: {
      id: true, title: true, body: true, publishedAt: true, stageKey: true,
      author: { select: { name: true, circleDisplayName: true } },
    },
  });

  const data = reflections.map((r) => ({
    id:          r.id,
    title:       r.title,
    body:        r.body,
    stageKey:    r.stageKey,
    publishedAt: r.publishedAt,
    displayName: displayNameFor(r.author), // first name / chosen name only
  }));

  return NextResponse.json({ reflections: data });
}

// ── POST: submit a reflection (goes to PENDING for admin review) ────────────
// RECIPIENT-only. Rate-limited. Runs advisory AI moderation, then stores PENDING.
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { role: true, currentStage: true },
  });
  if (me?.role !== "RECIPIENT") {
    return NextResponse.json({ error: "Only mothers can write reflections." }, { status: 403 });
  }
  if (!me.currentStage || !VALID_STAGES.has(me.currentStage)) {
    return NextResponse.json({ error: "We couldn't determine your stage. Please try again from your Circle." }, { status: 400 });
  }

  // Rate limit: a few submissions per day per account, plus an IP guard.
  const rl = rateLimit(`reflection-submit:${auth.userId}`, 5, 24 * 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You've shared a few reflections recently. Please come back a little later to write more." },
      { status: 429 }
    );
  }
  const ipRl = rateLimit(`reflection-submit-ip:${getClientIp(req)}`, 20, 24 * 60 * 60 * 1000);
  if (!ipRl.ok) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text  = typeof body.body  === "string" ? body.body.trim()  : "";

  if (title.length < 3 || title.length > 120) {
    return NextResponse.json({ error: "Please give your reflection a title (3 to 120 characters)." }, { status: 400 });
  }
  if (text.length < 50 || text.length > 8000) {
    return NextResponse.json({ error: "A reflection should be between 50 and 8000 characters." }, { status: 400 });
  }

  // Advisory AI moderation (never auto-decides). Always resolves.
  const flags = await checkReflection(title, text);

  const reflection = await prisma.reflection.create({
    data: {
      authorId:            auth.userId,
      stageKey:            me.currentStage,
      title,
      body:                text,
      status:              "PENDING",
      aiFlagNonReflective: flags.nonReflective,
      aiFlagCrisis:        flags.crisis,
      aiNote:              flags.note || null,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: reflection.id, status: "PENDING" }, { status: 201 });
}
