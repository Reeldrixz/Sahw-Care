import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";
const CONFIRMATION_WINDOW_DAYS = 14;
const VALID_FORMS = ["Powder", "Ready-to-feed", "Concentrate"];

// D/F3b: admit a mother to the 6-month formula programme. Admission = approval.
// This creates a pre-active AWAITING_CONFIRMATION episode that reserves capacity
// until she confirms the exact product (D/F3c). Capacity is re-checked INSIDE the
// transaction to close the double-admit race. No deliveries are created here;
// those come at confirmation.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const formulaBrand = typeof body.formulaBrand === "string" ? body.formulaBrand.trim() : "";
  const formulaType  = typeof body.formulaType  === "string" ? body.formulaType.trim()  : "";
  const formulaStage = typeof body.formulaStage === "string" ? body.formulaStage.trim() : "";
  const formulaForm  = typeof body.formulaForm  === "string" ? body.formulaForm.trim()  : "";
  const adminNote    = typeof body.adminNote    === "string" && body.adminNote.trim() ? body.adminNote.trim() : undefined;

  if (!formulaBrand || !formulaType || !formulaStage) {
    return NextResponse.json({ error: "Brand, type, and stage are all required to admit." }, { status: 400 });
  }
  if (!VALID_FORMS.includes(formulaForm)) {
    return NextResponse.json({ error: "Please choose the formula form (Powder, Ready-to-feed, or Concentrate)." }, { status: 400 });
  }

  const request = await prisma.formulaRequest.findUnique({
    where:  { id },
    select: { id: true, userId: true, status: true, babyDob: true },
  });
  if (!request) {
    return NextResponse.json({ error: "Formula request not found" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "This request has already been decided." }, { status: 409 });
  }

  const now      = new Date();
  const deadline = new Date(now.getTime() + CONFIRMATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let episodeId: string;
  try {
    episodeId = await prisma.$transaction(async (tx) => {
      // Capacity re-check inside the txn (fails closed: null config => 0).
      const config = await tx.formulaCapacityConfig.findUnique({ where: { id: SINGLETON_ID } });
      const max = config?.maxActiveEpisodes ?? 0;
      const [active, awaiting] = await Promise.all([
        tx.formulaEpisode.count({ where: { status: "ACTIVE" } }),
        tx.formulaEpisode.count({ where: { status: "AWAITING_CONFIRMATION" } }),
      ]);
      if (active + awaiting >= max) {
        throw new Error("FORMULA_AT_CAPACITY");
      }

      // One formula commitment per mother at a time.
      const existing = await tx.formulaEpisode.findFirst({
        where:  { userId: request.userId, status: { in: ["ACTIVE", "AWAITING_CONFIRMATION"] } },
        select: { id: true },
      });
      if (existing) {
        throw new Error("ALREADY_IN_EPISODE");
      }

      const episode = await tx.formulaEpisode.create({
        data: {
          userId:               request.userId,
          originatingRequestId: request.id,
          formulaBrand,
          formulaType,
          formulaStage,
          formulaForm,
          babyDob:              request.babyDob,
          status:               "AWAITING_CONFIRMATION",
          monthsTotal:          6,
          startedAt:            now,
          confirmationDeadline: deadline,
          admittedByAdminId:    admin.userId,
          adminNotes:           adminNote,
        },
        select: { id: true },
      });

      // Admission = approval.
      await tx.formulaRequest.update({
        where: { id: request.id },
        data:  { status: "APPROVED", reviewedAt: now, reviewedBy: admin.userId, ...(adminNote && { adminNote }) },
      });

      return episode.id;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FORMULA_AT_CAPACITY") {
      return NextResponse.json({ error: "No formula slots are available. Raise capacity before admitting.", code: "FORMULA_AT_CAPACITY" }, { status: 409 });
    }
    if (msg === "ALREADY_IN_EPISODE") {
      return NextResponse.json({ error: "This mother already has an active or awaiting formula episode.", code: "ALREADY_IN_EPISODE" }, { status: 409 });
    }
    console.error("[formula admit]", e);
    return NextResponse.json({ error: "Could not admit. Please try again." }, { status: 500 });
  }

  // Admission notification (best-effort, outside the txn). In-app always; email
  // when we have one. A mother with no email is reachable in-app only until SMS.
  const mother = await prisma.user.findUnique({
    where:  { id: request.userId },
    select: { name: true, email: true },
  });

  prisma.notification.create({
    data: {
      userId:  request.userId,
      type:    "BUNDLE_UPDATE",
      message: "Good news: you've been admitted to Kradel formula support. Please open the app and confirm your baby's exact formula so we can begin. It only takes a moment.",
      link:    "/bundles/formula-support",
    },
  }).catch(() => {});

  if (mother?.email) {
    getResend().emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
      to:      mother.email,
      subject: "Please confirm your baby's formula to begin",
      html:    `<p>Hi ${mother.name},</p><p>Good news: you've been admitted to Kradel formula support, six months of your baby's formula with no need to reapply. Before we begin, please confirm the exact formula so we send precisely what your baby uses. Open the app and tap to confirm. If anything isn't right, tell us and we'll fix it first.</p><p>The Kradel Team</p>`,
    }).catch((err) => console.error("[formula admit email]", err));
  }

  return NextResponse.json({ ok: true, episodeId, hasEmail: !!mother?.email });
}
