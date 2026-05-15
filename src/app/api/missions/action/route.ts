import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { recordMissionAction, type ActionType, type MissionActionMeta } from "@/lib/missions";

export const dynamic = "force-dynamic";

const VALID_TYPES: ActionType[] = [
  "click", "signup",
  "listing_posted", "register_committed",
  "listing_completed", "register_fulfilled",
  "bundle_delivered",
];

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { teamId, actionType, meta } = body as {
    teamId:     string;
    actionType: string;
    meta?:      MissionActionMeta;
  };

  if (!teamId || !actionType) {
    return NextResponse.json({ error: "teamId and actionType required" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(actionType as ActionType)) {
    return NextResponse.json({ error: "Invalid actionType" }, { status: 400 });
  }

  await recordMissionAction(auth.userId, actionType as ActionType, teamId, meta);

  return NextResponse.json({ ok: true });
}
