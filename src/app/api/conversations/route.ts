import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { countryCodeToFlag } from "@/lib/stage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: user.userId } },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatar: true, countryCode: true } },
        },
      },
      request: {
        include: {
          item: { select: { id: true, title: true, images: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = conversations.map((conv) => ({
    ...conv,
    participants: conv.participants.map((p) => ({
      ...p,
      user: {
        id:          p.user.id,
        name:        p.user.name,
        avatar:      p.user.avatar,
        countryFlag: (p.user as { countryCode?: string | null }).countryCode
          ? countryCodeToFlag((p.user as { countryCode: string }).countryCode)
          : null,
      },
    })),
  }));

  return NextResponse.json({ conversations: formatted });
}
