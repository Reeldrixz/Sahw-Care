import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { getUserCooldowns, checkCooldown, CATEGORY_CONFIG } from "@/lib/cooldown";

export const dynamic = "force-dynamic";

// GET /api/cooldown — all category cooldowns for the current user
export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  if (category) {
    const result = await checkCooldown(auth.userId, category);
    return NextResponse.json({ ...result, config: CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG["Other"] });
  }

  const cooldowns = await getUserCooldowns(auth.userId);
  return NextResponse.json({ cooldowns, config: CATEGORY_CONFIG });
}
