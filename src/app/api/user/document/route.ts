import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { uploadImage } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_TYPES = [
  "Hospital appointment letter",
  "Birth certificate",
  "Pregnancy scan / ultrasound",
  "Immunisation card",
  "Other maternity document",
];

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentType = formData.get("documentType") as string | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!documentType || !VALID_TYPES.includes(documentType)) {
      return NextResponse.json({ error: "Please select a document type" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, WebP or PDF allowed" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImage(buffer, `kradel/documents/${payload.userId}`);

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        documentUrl: url,
        documentType,
        docStatus: "PENDING",
        documentNote: null, // clear any previous rejection note
      },
      select: {
        id: true, docStatus: true, documentType: true, documentNote: true, verifiedAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
