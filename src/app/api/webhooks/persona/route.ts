import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "crypto";
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

// ── Persona API: fetch government-ID document fields ─────────────────────────

async function fetchPersonaDocument(
  inquiryId: string,
): Promise<{ docNumber: string; countryCode: string } | null> {
  const apiKey = process.env.PERSONA_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://withpersona.com/api/v1/inquiries/${inquiryId}?include=verifications`,
      {
        headers: {
          Authorization:     `Bearer ${apiKey}`,
          "Persona-Version": "2023-01-05",
          Accept:            "application/json",
        },
      },
    );
    if (!res.ok) {
      console.warn("[persona-webhook] Persona API fetch failed:", res.status);
      return null;
    }
    const data = await res.json();
    const included: unknown[] = Array.isArray(data.included) ? data.included : [];

    // Find the passed government-ID verification
    const govId = included.find((v: unknown) => {
      const ver = v as Record<string, unknown>;
      return (
        ver.type === "verification/government-id" &&
        (ver.attributes as Record<string, unknown>)?.status === "passed"
      );
    }) as Record<string, Record<string, unknown>> | undefined;

    if (!govId) return null;

    const identificationNumber = govId.attributes?.["identification-number"];
    const documentNumber       = govId.attributes?.["document-number"];
    const countryCode          = govId.attributes?.["country-code"];

    let docNumber: unknown;
    let docField: string;
    if (identificationNumber) {
      docNumber = identificationNumber;
      docField  = "identification-number";
    } else if (documentNumber) {
      docNumber = documentNumber;
      docField  = "document-number";
    } else {
      console.warn("[persona-webhook] No identification-number or document-number on verification — skipping hash");
      return null;
    }

    if (!countryCode) return null;

    console.log("[persona-webhook] Hashing from field:", docField, "country:", String(countryCode).toUpperCase());

    return {
      docNumber:   String(docNumber).trim().toUpperCase(),
      countryCode: String(countryCode).trim().toUpperCase(),
    };
  } catch (err) {
    console.warn("[persona-webhook] Error fetching Persona document:", err);
    return null;
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
    select: { id: true, email: true, identityVerified: true, personaInquiryId: true },
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
        message: "Your identity has been verified. You're all set",
        link:    "/profile",
      },
    });

    // ── Duplicate identity detection ───────────────────────────────────────
    const doc = await fetchPersonaDocument(inquiryId);
    if (doc) {
      const salt         = process.env.PERSONA_DEDUPE_SALT ?? "";
      const identityHash = createHash("sha256")
        .update(salt + doc.countryCode + doc.docNumber)
        .digest("hex");

      const duplicate = await prisma.user.findFirst({
        where:  { identityHash, id: { not: user.id } },
        select: { id: true, deletedAt: true, accountHold: true },
      });

      if (duplicate) {
        const isDeletedAccount = duplicate.deletedAt != null;

        let holdReason: string;
        let adminMessage: string;

        if (isDeletedAccount) {
          holdReason = "Duplicate identity — matches a previously deleted account";

          const [flagCount, eventCount] = await Promise.all([
            prisma.abuseFlag.count({ where: { userId: duplicate.id } }),
            prisma.abuseEventLog.count({ where: { userId: duplicate.id } }),
          ]);

          const deletedOn = duplicate.deletedAt!.toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
          });
          const wasHeld = duplicate.accountHold ? "held" : "not held";
          const bLabel  = user.email ?? user.id;

          adminMessage =
            `Duplicate identity match on new account ${bLabel}. ` +
            `Matched account (${duplicate.id}) was deleted on ${deletedOn}, ` +
            `had ${flagCount} prior flag(s), ${eventCount} abuse event(s), ` +
            `and was ${wasHeld} at the time of deletion.`;
        } else {
          holdReason   = "Duplicate identity — matches an existing account";
          adminMessage = `Account ${user.id} verified with a document already on account ${duplicate.id}. Auto-hold applied.`;
        }

        // Same document verified on a different account → auto-hold the newly verified one
        await prisma.user.update({
          where: { id: user.id },
          data: {
            identityHash,
            accountHold:       true,
            accountHoldReason: holdReason,
            accountHoldAt:     new Date(),
          },
        });

        // In-app alert for every admin
        const admins = await prisma.user.findMany({
          where:  { role: "ADMIN" },
          select: { id: true },
        });
        if (admins.length > 0) {
          await prisma.notification.createMany({
            data: admins.map((a) => ({
              userId:   a.id,
              type:     "ADMIN_MESSAGE" as const,
              title:    "Duplicate identity flagged",
              message:  adminMessage,
              link:     `/admin?userId=${user.id}`,
              metadata: { newUserId: user.id, existingUserId: duplicate.id },
            })),
          });
        }

        console.warn(
          "[persona-webhook] Duplicate identity: new=%s existing=%s deleted=%s — hold applied",
          user.id,
          duplicate.id,
          isDeletedAccount,
        );
      } else {
        // No duplicate — store hash (or refresh on re-verification)
        await prisma.user.update({
          where: { id: user.id },
          data:  { identityHash },
        });
      }
    }

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
