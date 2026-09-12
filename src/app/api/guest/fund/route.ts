import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { computeBreakdown, MIN_GIFT_CENTS } from "@/lib/checkoutFees";
import { rateLimitAsync, getClientIp } from "@/lib/rateLimit";
import { resolveEventIdForAttribution } from "@/lib/fundraisingEvent";

export const dynamic = "force-dynamic";

// Guest funding for a register item. No Kradel account.
//
// A SEPARATE ROUTE, NOT A RELAXED ONE. /api/registers stays fully gated: that
// path carries address confirmation, item management and register mutation, and
// opening it so one unauthenticated action can reach through would expose all of
// them. This route does exactly one thing and has no other capability.
//
// Everything the authenticated route gets for free from having a session has to
// be rebuilt here:
//   - rate limiting keyed on IP, because there is no userId to key on
//   - the register re-verified as publicly fundable, since no session implied it
//   - the amount re-derived server-side; the client's number is only validated
//
// The payment lands as a RegisterItemFunding row with donorId NULL and guestEmail
// set. The Stripe webhook's Phase 1 records it unconditionally, and Phase 3 skips
// every donor-keyed side effect.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  // No userId exists, so the limit is per IP. Tighter than the authenticated
  // route's 15/5min because an unauthenticated endpoint that creates Stripe
  // sessions is a more attractive thing to hammer.
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`guest-fund:${ip}`, 8, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Please wait ${rl.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { registerItemId, amountCents, email, supportOn = true, coverStripe = true, eventSlug } = body ?? {};

  if (typeof registerItemId !== "string" || !registerItemId) {
    return NextResponse.json({ error: "registerItemId is required" }, { status: 400 });
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "amountCents must be a positive integer" }, { status: 400 });
  }
  if (amountCents < MIN_GIFT_CENTS) {
    return NextResponse.json({ error: `Minimum contribution is $${MIN_GIFT_CENTS / 100}` }, { status: 400 });
  }

  // Email is REQUIRED for a guest, not optional. With no account behind the
  // payment it is the only channel that exists for a receipt or a refund, which
  // makes it part of taking the money responsibly rather than a nice-to-have.
  const guestEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(guestEmail) || guestEmail.length > 200) {
    return NextResponse.json(
      { error: "A valid email is required — it's where your receipt goes, and where a refund would go if one is ever needed." },
      { status: 400 },
    );
  }

  // Re-verify the item is genuinely fundable by the public. No session implied
  // any of this, so all of it is checked here.
  const item = await prisma.registerItem.findUnique({
    where:   { id: registerItemId },
    include: { register: { select: { id: true, status: true, creatorId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  // Only a live register is publicly fundable. DRAFT, COMPLETED, CLOSED and
  // ABANDONED are all refused — the same boundary the public share page applies.
  if (item.register.status !== "ACTIVE") {
    return NextResponse.json({ error: "This register isn't accepting contributions right now." }, { status: 409 });
  }
  if (item.status === "PENDING_APPROVAL" || item.status === "CANCELLED") {
    return NextResponse.json({ error: "This item isn't available." }, { status: 409 });
  }
  if (["FULLY_FUNDED", "IN_FULFILLMENT", "FULFILLED"].includes(item.fundingStatus)) {
    return NextResponse.json({ error: "This item is already fully funded." }, { status: 409 });
  }

  // The self-fund block has no guest equivalent and needs none: a guest has no
  // identity to compare against the register's creator. A logged-in mother
  // funding her own register is still blocked on the authenticated route.

  // Fees computed server-side from the validated amount. The client supplies
  // intent, never arithmetic.
  const breakdown = computeBreakdown(amountCents, Boolean(supportOn), Boolean(coverStripe));

  // No pending-session resume for guests: resuming keys on donorId, which does
  // not exist here. A duplicate PENDING row is harmless and is cleaned up by the
  // checkout.session.expired handler.
  // Attribution. Resolved from the SLUG, never the host token, and null-safe by
  // design: an unknown slug or a non-LIVE event records null and the payment
  // proceeds. Attribution is bookkeeping and must never cost a contribution.
  const fundraisingEventId = await resolveEventIdForAttribution(eventSlug);

  const funding = await prisma.registerItemFunding.create({
    data: {
      registerItemId:  item.id,
      donorId:         null,
      guestEmail,
      fundraisingEventId,
      amountCents:     breakdown.itemSubtotal,
      kradelFee:       breakdown.kradelFee,
      optionalSupport: breakdown.optionalSupport,
      stripeFee:       breakdown.stripeFee,
      totalCharged:    breakdown.total,
      status:          "PENDING",
    },
  });

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    await prisma.registerItemFunding.delete({ where: { id: funding.id } });
    return NextResponse.json({ error: "Payment service is unavailable" }, { status: 503 });
  }

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const registerId = item.register.id;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      // Stripe sends the receipt here. For a guest this is the legally
      // meaningful copy of the transaction, since there is no account to find it
      // in later.
      customer_email: guestEmail,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: breakdown.total,
          product_data: {
            name: item.name,
            description: `Gift contribution${breakdown.stripeFee > 0 ? " (incl. processing fee)" : ""}`,
          },
        },
      }],
      metadata: {
        fundingId: funding.id,
        itemId:    item.id,
        registerId,
        // No donorId. isGuest tells the webhook that absence is intentional
        // rather than metadata having gone missing — the difference between a
        // guest payment and a bug that must be shouted about.
        isGuest: "true",
      },
      success_url: `${appUrl}/r/${registerId}?payment=success&item=${item.id}`,
      cancel_url:  `${appUrl}/r/${registerId}?payment=cancel`,
    });
  } catch (err) {
    await prisma.registerItemFunding.delete({ where: { id: funding.id } });
    console.error("[guest/fund] Stripe session creation failed:", err);
    return NextResponse.json({ error: "Failed to create payment session" }, { status: 500 });
  }

  await prisma.registerItemFunding.update({
    where: { id: funding.id },
    data:  { stripeSessionId: session.id },
  });

  return NextResponse.json({ sessionUrl: session.url }, { status: 201 });
}
