import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const creatorId = searchParams.get("creatorId");

  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;

  const registers = await prisma.register.findMany({
    where: {
      ...(city && { city: { contains: city, mode: "insensitive" } }),
      ...(creatorId
        ? { creatorId }
        : { status: "ACTIVE" }
      ),
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
          catalogItem: { select: { imageUrl: true } },
        },
      },
    },
  });

  const savedIds = auth
    ? new Set(
        (await prisma.savedRegister.findMany({
          where: { userId: auth.userId },
          select: { registerId: true },
        })).map((s) => s.registerId)
      )
    : new Set<string>();

  const result = registers.map((r) => ({ ...r, savedByMe: savedIds.has(r.id) }));
  return NextResponse.json({ registers: result });
}

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Trust gate: score >= 25 required to create a register
  const creator = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { trustScore: true },
  });

  if (!creator) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (creator.trustScore < 25) {
    return NextResponse.json({
      error: "Complete your profile verification to create a register.",
      code: "TRUST_SCORE_TOO_LOW",
    }, { status: 403 });
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
