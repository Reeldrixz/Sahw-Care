import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteImage, getPublicIdFromUrl } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { confirmation } = await req.json();
  if (confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  }

  // ── Fetch user data needed for cleanup ───────────────────────────────────
  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: {
      id: true, avatar: true, documentUrl: true,
      email: true, phone: true, name: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ── Log deletion event (before wiping device logs) ───────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
           ?? req.headers.get("x-real-ip") ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  await prisma.deviceLog.create({
    data: {
      userId:    user.id,
      ipAddress: ip,
      userAgent: ua,
      action:    `account_deleted | was: ${user.email ?? user.phone ?? "unknown"}`,
    },
  }).catch(() => {});

  // ── Delete Cloudinary assets ─────────────────────────────────────────────
  const cloudinaryCleanup: Promise<void>[] = [];
  if (user.avatar)      cloudinaryCleanup.push(deleteImage(getPublicIdFromUrl(user.avatar)).catch(() => {}));
  if (user.documentUrl) cloudinaryCleanup.push(deleteImage(getPublicIdFromUrl(user.documentUrl)).catch(() => {}));
  await Promise.allSettled(cloudinaryCleanup);

  // ── Database cleanup (order matters for FK constraints) ──────────────────

  // Circle activity — hard delete
  await prisma.circlePost.deleteMany({ where: { userId: user.id } });
  await prisma.postReaction.deleteMany({ where: { userId: user.id } });
  await prisma.postComment.deleteMany({ where:  { userId: user.id } });
  await prisma.postReport.deleteMany({ where:   { reportedBy: user.id } });
  await prisma.circleMember.deleteMany({ where: { userId: user.id } });

  // Items — set to REMOVED (preserves donation history references)
  await prisma.item.updateMany({
    where: { donorId: user.id },
    data:  { status: "REMOVED" },
  });

  // Requests — delete pending ones; fulfilled ones stay for audit
  await prisma.request.deleteMany({
    where: { requesterId: user.id, status: { in: ["PENDING", "APPROVED"] } },
  });

  // Messages — anonymize text (keep conversation structure intact)
  await prisma.message.updateMany({
    where: { senderId: user.id },
    data:  { text: "This user has deleted their account." },
  });

  // Anti-abuse / session data
  await prisma.otpVerification.deleteMany({ where:  { userId: user.id } });
  await prisma.categoryCooldown.deleteMany({ where: { userId: user.id } });
  await prisma.urgentOverride.deleteMany({ where:   { userId: user.id } });

  // Reviews — keep for donor trust history; reviewer name anonymized via user wipe

  // ── Anonymise user record (GDPR erasure — wipe all PII) ─────────────────
  await prisma.user.update({
    where: { id: user.id },
    data:  {
      name:                  "Deleted User",
      email:                 null,
      phone:                 null,
      password:              `__deleted__${Date.now()}`,
      avatar:                null,
      location:              null,
      documentUrl:           null,
      documentType:          null,
      documentNote:          null,
      verifiedAt:            null,
      onboardingComplete:    false,
      journeyType:           null,
      dueDate:               null,
      babyBirthDate:         null,
      currentStage:          null,
      currentCircleId:       null,
      countryCode:           null,
      countryFlag:           null,
      subTags:               [],
      graduatedCircleIds:    [],
      status:                "SUSPENDED",
      deletedAt:             new Date(),
    },
  });

  // ── Invalidate session ───────────────────────────────────────────────────
  const response = NextResponse.json({ success: true });
  response.cookies.delete("cc_token");
  return response;
}
