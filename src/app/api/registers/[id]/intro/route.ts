import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { copyeditIntro, MAX_INTRO_INPUT } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function requireCreator(req: NextRequest, id: string) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const register = await prisma.register.findUnique({ where: { id }, select: { creatorId: true } });
  if (!register) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (register.creatorId !== auth.userId) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { auth };
}

// POST → light AI copyedit. Returns a suggested edit for her approval; saves nothing.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const gate = await requireCreator(req, id);
  if ("error" in gate) return gate.error;

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Write your intro first" }, { status: 400 });
  if (text.trim().length > MAX_INTRO_INPUT) {
    return NextResponse.json({ error: `Please keep it under ${MAX_INTRO_INPUT} characters` }, { status: 400 });
  }

  try {
    const edited = await copyeditIntro(text);
    return NextResponse.json({ edited });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Editing failed" }, { status: 502 });
  }
}

// PUT → save the approved intro (she has final say). Empty/blank clears it,
// falling back to the default template.
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const gate = await requireCreator(req, id);
  if ("error" in gate) return gate.error;

  const { intro } = await req.json();
  const value = typeof intro === "string" && intro.trim() ? intro.trim().slice(0, 2000) : null;

  const updated = await prisma.register.update({
    where:  { id },
    data:   { intro: value },
    select: { intro: true },
  });
  return NextResponse.json({ intro: updated.intro });
}
