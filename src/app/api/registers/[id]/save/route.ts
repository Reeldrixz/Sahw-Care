import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ error: "Use /api/registers/[id]/items/[itemId]/save instead" }, { status: 410 });
}
