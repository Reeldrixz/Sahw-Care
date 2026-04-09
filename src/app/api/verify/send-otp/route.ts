import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerification } from "@/lib/otp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await req.json(); // "PHONE" | "EMAIL"
  if (!["PHONE", "EMAIL"].includes(type)) {
    return NextResponse.json({ error: "type must be PHONE or EMAIL" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Already verified?
  if (type === "PHONE" && user.phoneVerified) {
    return NextResponse.json({ error: "Phone already verified" }, { status: 400 });
  }
  if (type === "EMAIL" && user.emailVerified) {
    return NextResponse.json({ error: "Email already verified" }, { status: 400 });
  }

  // Need matching contact info
  if (type === "PHONE" && !user.phone) {
    return NextResponse.json({ error: "No phone number on account" }, { status: 400 });
  }
  if (type === "EMAIL" && !user.email) {
    return NextResponse.json({ error: "No email address on account" }, { status: 400 });
  }

  try {
    if (type === "PHONE") {
      await sendVerification(user.phone!, "sms");
    } else {
      await sendVerification(user.email!, "email");
    }
  } catch (err) {
    console.error("[send-otp]", err);
    return NextResponse.json({ error: "Failed to send verification code. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
