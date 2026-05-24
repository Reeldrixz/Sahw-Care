import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Persona webhook payload shape (API v2023-01-05, default kebab-case keys) ─

interface PersonaInquiryAttributes {
  status: string;
  "reference-id": string | null;
  [key: string]: unknown;
}

interface PersonaWebhookPayload {
  data: {
    type: "event";
    id: string; // evt_xxx — used for idempotency
    attributes: {
      name: string; // "inquiry.approved" | "inquiry.declined" | …
      payload: {
        data: {
          type: "inquiry";
          id: string; // inq_xxx
          attributes: PersonaInquiryAttributes;
        };
      };
    };
  };
}

// ── Signature verification ────────────────────────────────────────────────────

function verifyPersonaSignature(
  rawBody: string,
  sigHeader: string,
  secret: string,
): boolean {
  try {
    // Header format: "t=<timestamp>,v1=<hex-signature>"
    const parts: Record<string, string> = {};
    for (const part of sigHeader.split(",")) {
      const idx = part.indexOf("=");
      if (idx !== -1) parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
    const { t, v1 } = parts;
    if (!t || !v1) return false;

    const expected = createHmac("sha256", secret)
      .update(`${t}.${rawBody}`)
      .digest("hex");

    // Constant-time comparison — compare as UTF-8 buffers of the hex strings
    const expectedBuf = Buffer.from(expected);
    const actualBuf   = Buffer.from(v1);
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

// ── Event handler ─────────────────────────────────────────────────────────────

async function handleInquiryEvent(
  eventName:   string,
  inquiryId:   string,
  referenceId: string | null,
): Promise<void> {
  // Locate user by reference-id (the userId we set at inquiry creation), falling back
  // to personaInquiryId in case the reference-id wasn't stored correctly.
  const user = await prisma.user.findFirst({
    where:  referenceId ? { id: referenceId } : { personaInquiryId: inquiryId },
    select: { id: true, identityVerified: true, personaInquiryId: true },
  });

  if (!user) {
    console.warn("[persona-webhook] No user found — inquiryId:", inquiryId, "refId:", referenceId);
    return;
  }

  if (eventName === "inquiry.approved") {
    // Idempotency: already approved for this inquiry — skip
    if (user.identityVerified && user.personaInquiryId === inquiryId) return;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        identityVerified:   true,
        identityVerifiedAt: new Date(),
        personaInquiryId:   inquiryId,
        personaStatus:      "approved",
      },
    });

    await prisma.notification.create({
      data: {
        userId:  user.id,
        type:    "VERIFICATION_APPROVED",
        message: "Your identity has been verified — you're all set 💛",
        link:    "/profile",
      },
    });

    return;
  }

  // declined / failed / expired — don't downgrade a user already approved
  const declinedEvents: Record<string, string> = {
    "inquiry.declined": "declined",
    "inquiry.failed":   "failed",
    "inquiry.expired":  "expired",
  };

  if (declinedEvents[eventName]) {
    if (user.identityVerified) return; // never downgrade

    await prisma.user.update({
      where: { id: user.id },
      data: {
        personaInquiryId: inquiryId,
        personaStatus:    declinedEvents[eventName],
        // identityVerified stays false
      },
    });

    return;
  }

  // Unrecognised event — ack without action
  console.log("[persona-webhook] Unhandled event:", eventName);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const secret = process.env.PERSONA_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[persona-webhook] PERSONA_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const sigHeader = req.headers.get("persona-signature");
  if (!sigHeader || !verifyPersonaSignature(rawBody, sigHeader, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: PersonaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName  = payload.data?.attributes?.name;
  const inquiryId  = payload.data?.attributes?.payload?.data?.id;
  const referenceId =
    payload.data?.attributes?.payload?.data?.attributes?.["reference-id"] ?? null;

  // Ack unknown or malformed events immediately
  if (!eventName || !inquiryId) {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleInquiryEvent(eventName, inquiryId, referenceId);
  } catch (err) {
    console.error("[persona-webhook] Handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
