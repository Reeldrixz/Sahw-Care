import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// A mother's OWN reflections, across all statuses, so she can see what's pending
// or published. Scoped strictly to the caller (authorId = auth.userId). Never
// exposes AI flags, admin notes, or rejection internals.
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

  const reflections = await prisma.reflection.findMany({
    where:   { authorId: auth.userId },
    orderBy: { createdAt: "desc" },
    take:    50,
    select: {
      id: true, title: true, body: true, stageKey: true,
      status: true, createdAt: true, publishedAt: true,
    },
  });

  return NextResponse.json({ reflections });
}
