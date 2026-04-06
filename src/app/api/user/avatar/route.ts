import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { uploadAvatar } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG or WebP allowed" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadAvatar(buffer, payload.userId);

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: { avatar: url },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        avatar: true, location: true, isPremium: true, trustRating: true,
        trustScore: true, verificationLevel: true, phoneVerified: true,
        emailVerified: true, urgentOverridesUsed: true, urgentOverridesResetAt: true,
        status: true, createdAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
