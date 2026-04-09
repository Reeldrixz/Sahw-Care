import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const creatorId = searchParams.get("creatorId");

  const registers = await prisma.register.findMany({
    where: {
      ...(city && { city: { contains: city, mode: "insensitive" } }),
      ...(creatorId && { creatorId }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, name: true, location: true } },
      items: { select: { id: true, status: true } },
    },
  });

  return NextResponse.json({ registers });
}

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Enforce Layer 2 verification before allowing register creation
  const creator = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { phoneVerified: true, emailVerified: true, avatar: true, docStatus: true },
  });

  if (!creator) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const layer1Complete = (creator.phoneVerified || creator.emailVerified) && !!creator.avatar;
  if (!layer1Complete) {
    return NextResponse.json({
      error: "Please complete your profile first — verify your phone or email and add a profile photo.",
      code: "LAYER1_INCOMPLETE",
    }, { status: 403 });
  }

  if (creator.docStatus !== "VERIFIED") {
    const msg =
      creator.docStatus === "PENDING"
        ? "Your document is under review — usually within 24 hours. We'll let you know as soon as it's confirmed!"
        : creator.docStatus === "REJECTED"
        ? "Your document wasn't accepted. Please upload a new one from your profile settings."
        : "To create a Register, please upload a document to help us protect our community.";
    return NextResponse.json({ error: msg, code: "LAYER2_REQUIRED" }, { status: 403 });
  }

  const { title, city, dueDate } = await req.json();
  if (!title || !city || !dueDate) {
    return NextResponse.json({ error: "Title, city and due date are required" }, { status: 400 });
  }

  const register = await prisma.register.create({
    data: {
      title,
      city,
      dueDate: new Date(dueDate),
      creatorId: auth.userId,
    },
    include: {
      creator: { select: { id: true, name: true, location: true } },
      items: true,
    },
  });

  return NextResponse.json({ register }, { status: 201 });
}
