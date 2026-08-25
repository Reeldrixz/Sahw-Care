import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Self-declared motherhood — the eligibility basis for Experiences.
//
// Its own endpoint rather than reusing /api/user/onboarding, which rewrites
// journeyType and resets her circle assignment. Motherhood is independent of
// journey: a mother who gives is still a mother, and changing one must not
// disturb the other.
//
// Setting it FALSE stops new Experiences posts and comments (canWriteExperiences
// reads the live flag) but deliberately does nothing to what she already wrote.
// Those were true when written, other mothers may be relying on them, and
// retracting knowledge would punish contribution.
export async function PATCH(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isMother } = await req.json().catch(() => ({}));
  if (typeof isMother !== "boolean") {
    return NextResponse.json({ error: "isMother must be true or false." }, { status: 400 });
  }

  // Always stamp the timestamp: it records that she was asked and answered, so
  // she is not prompted again either way.
  await prisma.user.update({
    where: { id: auth.userId },
    data:  { isMother, motherhoodDeclaredAt: new Date() },
  });

  return NextResponse.json({ ok: true, isMother });
}
