import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const QUICK_MESSAGES: Record<string, string> = {
  IM_HERE:       "I'm here",
  RUNNING_LATE:  "Running a few minutes late",
  ON_MY_WAY:     "On my way",
  CANT_MAKE_IT:  "I can't make this time — can we reschedule?",
  PICKUP_COMPLETE: "Pickup complete",
};

function containsContactInfo(text: string): boolean {
  const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const socialRegex = /whatsapp|wa\.me|telegram|snapchat|instagram/i;
  return phoneRegex.test(text) || emailRegex.test(text) || socialRegex.test(text);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coordination = await prisma.pickupCoordination.findUnique({
    where: { requestId },
    include: { request: { include: { item: { select: { donorId: true } } } } },
  });

  if (!coordination) return NextResponse.json({ error: "Coordination not found" }, { status: 404 });

  const donorId = coordination.request.item.donorId;
  const recipientId = coordination.request.requesterId;
  const isParty = user.userId === donorId || user.userId === recipientId;
  if (!isParty) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const terminalStatuses = ["CONFIRMED", "CANCELLED"];
  if (terminalStatuses.includes(coordination.status)) {
    return NextResponse.json({ error: "Coordination is closed" }, { status: 409 });
  }

  const { messageType, content } = await req.json();

  if (!messageType) return NextResponse.json({ error: "messageType is required" }, { status: 400 });

  // Quick messages: no content needed
  if (messageType !== "CUSTOM") {
    if (!QUICK_MESSAGES[messageType]) {
      return NextResponse.json({ error: "Invalid messageType" }, { status: 400 });
    }
    const message = await prisma.coordinationMessage.create({
      data: { coordinationId: coordination.id, senderId: user.userId, messageType },
      include: { sender: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ message });
  }

  // CUSTOM: validate content
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content is required for CUSTOM messages" }, { status: 400 });
  }
  if (content.trim().length > 200) {
    return NextResponse.json({ error: "Message too long (max 200 characters)" }, { status: 400 });
  }
  if (containsContactInfo(content)) {
    // Create an abuse flag silently
    prisma.abuseFlag.create({
      data: {
        userId: user.userId,
        flagType: "OFF_PLATFORM_CONTACT",
        severity: "MEDIUM",
        evidence: { coordinationId: coordination.id, requestId, content },
      },
    }).catch(() => {});

    return NextResponse.json({
      error: "Please keep contact details inside Kradəl only.",
      code: "CONTACT_INFO_DETECTED",
    }, { status: 400 });
  }

  const message = await prisma.coordinationMessage.create({
    data: { coordinationId: coordination.id, senderId: user.userId, messageType: "CUSTOM", content: content.trim() },
    include: { sender: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ message });
}
