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
      creator: { select: { id: true, name: true, location: true, verificationLevel: true } },
      items: {
        select: {
          id: true,
          status: true,
          fundingStatus: true,
          standardPriceCents: true,
          totalFundedCents: true,
          _count: { select: { funding: true } },
        },
      },
    },
  });

  return NextResponse.json({ registers });
}

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Enforce verification before allowing register creation
  const creator = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { phoneVerified: true, emailVerified: true, avatar: true, docStatus: true, verificationLevel: true },
  });

  if (!creator) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // verificationLevel >= 2 bypasses all individual field checks
  const fullyVerified = creator.verificationLevel >= 2;

  if (!fullyVerified) {
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
  }

  const { title, city, dueDate, addressMode, savedAddress } = await req.json();
  if (!title || !city || !dueDate) {
    return NextResponse.json({ error: "Title, city and due date are required" }, { status: 400 });
  }

  const mode: "ASK_PER_SHIPMENT" | "SAVED_PER_REGISTER" =
    addressMode === "SAVED_PER_REGISTER" ? "SAVED_PER_REGISTER" : "ASK_PER_SHIPMENT";

  if (mode === "SAVED_PER_REGISTER" && !savedAddress) {
    return NextResponse.json({ error: "Saved address required for this mode" }, { status: 400 });
  }
  if (mode === "ASK_PER_SHIPMENT" && savedAddress) {
    return NextResponse.json({ error: "Address not needed for ask-per-shipment mode" }, { status: 400 });
  }
  if (mode === "SAVED_PER_REGISTER") {
    const { fullName, streetAddress, city: addrCity, province, postalCode, phone } = savedAddress ?? {};
    if (!fullName || !streetAddress || !addrCity || !province || !postalCode || !phone) {
      return NextResponse.json({ error: "All address fields are required" }, { status: 400 });
    }
  }

  const register = await prisma.$transaction(async (tx) => {
    const reg = await tx.register.create({
      data: {
        title, city, dueDate: new Date(dueDate),
        creatorId: auth.userId,
        addressMode: mode,
      },
      include: { creator: { select: { id: true, name: true, location: true } }, items: true },
    });
    if (mode === "SAVED_PER_REGISTER" && savedAddress) {
      await tx.registerAddress.create({
        data: {
          registerId: reg.id,
          fullName:      String(savedAddress.fullName),
          streetAddress: String(savedAddress.streetAddress),
          unit:          savedAddress.unit ? String(savedAddress.unit) : null,
          city:          String(savedAddress.city),
          province:      String(savedAddress.province),
          postalCode:    String(savedAddress.postalCode),
          phone:         String(savedAddress.phone),
        },
      });
    }
    return reg;
  });

  return NextResponse.json({ register }, { status: 201 });
}
