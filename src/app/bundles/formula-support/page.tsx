import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { monthlyCooldown, formatCooldownDate } from "@/lib/cooldowns";
import FormulaSupportForm from "./FormulaSupportForm";
import FormulaConfirmCard from "./FormulaConfirmCard";
import FormulaProgressCard from "./FormulaProgressCard";
import FormulaStageChangeCard from "./FormulaStageChangeCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formula support · Kradel",
  description: "Request help affording the formula your baby already uses.",
};

const CARD = "#ffffff";
const INK = "#1a1a1a";
const MUTED = "#555555";
const GREEN = "#1a7a5e";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

// RECIPIENT-only intake. /bundles is already behind auth (proxy), so a visitor
// here is logged in; we additionally require the RECIPIENT role and show a calm
// message otherwise. The POST API enforces the same gate as the real boundary.
export default async function FormulaSupportPage() {
  const currentUser = await getCurrentUser().catch(() => null);
  const account = currentUser
    ? await prisma.user.findUnique({
        where:  { id: currentUser.userId },
        select: { role: true },
      })
    : null;
  const isRecipient = account?.role === "RECIPIENT";

  // Episode takes precedence over everything below. Admission flips her request
  // to APPROVED, which would otherwise trip the legacy cooldown branch and hide
  // the confirmation card, so the episode is the source of truth here. At most
  // one AWAITING_CONFIRMATION or ACTIVE episode exists (enforced at admission).
  const episode = isRecipient && currentUser
    ? await prisma.formulaEpisode.findFirst({
        where:   { userId: currentUser.userId, status: { in: ["AWAITING_CONFIRMATION", "ACTIVE"] } },
        orderBy: { startedAt: "desc" },
        select:  {
          id: true, status: true,
          formulaBrand: true, formulaType: true, formulaStage: true, formulaForm: true,
          monthsTotal: true,
          pendingFormulaStage: true,
          deliveries: {
            orderBy: { monthIndex: "asc" },
            select:  { monthIndex: true, status: true, scheduledFor: true, fulfilledAt: true },
          },
        },
      })
    : null;

  // Formula receipt cooldown (own clock, independent of bundles): keyed off the
  // last APPROVED formula request. Pending/declined never start the clock.
  // Only relevant to mothers who were never admitted to an episode.
  // One-and-done: a mother who COMPLETED her 6 months sees a warm, final
  // completion state instead of the request form. COMPLETED only — an
  // ENDED-early episode doesn't count (she can still be admitted again).
  const completedEpisode = isRecipient && currentUser
    ? await prisma.formulaEpisode.findFirst({
        where:   { userId: currentUser.userId, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select:  { id: true, completedAt: true },
      })
    : null;

  const lastApprovedFormula = isRecipient && currentUser
    ? await prisma.formulaRequest.findFirst({
        where:   { userId: currentUser.userId, status: "APPROVED" },
        orderBy: { reviewedAt: "desc" },
        select:  { reviewedAt: true },
      })
    : null;
  const formulaCooldown = monthlyCooldown(lastApprovedFormula?.reviewedAt ?? null);

  return (
    <main style={{ background: "var(--bg, #faf7f2)", minHeight: "100vh", fontFamily: SANS }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 64px" }}>
        <Link href="/bundles" style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: GREEN, textDecoration: "none" }}>
          ← Back to bundles
        </Link>

        {isRecipient && episode?.status === "AWAITING_CONFIRMATION" ? (
          <FormulaConfirmCard
            episodeId={episode.id}
            formulaBrand={episode.formulaBrand}
            formulaType={episode.formulaType}
            formulaStage={episode.formulaStage}
            formulaForm={episode.formulaForm}
          />
        ) : isRecipient && episode?.status === "ACTIVE" ? (
          <>
            {/* D/F4d: pending-stage re-confirmation card — shown above the
                progress view whenever a stage change awaits her confirmation. */}
            {episode.pendingFormulaStage && (
              <FormulaStageChangeCard
                episodeId={episode.id}
                currentStage={episode.formulaStage}
                proposedStage={episode.pendingFormulaStage}
              />
            )}
            {episode.deliveries.length > 0 ? (
              <FormulaProgressCard
                formulaBrand={episode.formulaBrand}
                formulaType={episode.formulaType}
                formulaStage={episode.formulaStage}
                formulaForm={episode.formulaForm}
                monthsTotal={episode.monthsTotal}
                deliveries={episode.deliveries}
              />
            ) : (
              // Fallback: active but no deliveries yet (shouldn't happen post-confirm).
              <div style={{ background: "#e8f5f1", border: "1px solid #c3e6cb", borderRadius: 14, padding: "28px 24px", marginTop: 20 }}>
                <h1 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: INK, margin: "0 0 10px" }}>
                  Your formula support is active
                </h1>
                <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
                  We&apos;ll prepare your formula each month. We aim for every month, though occasionally one may be delayed.
                </p>
              </div>
            )}
          </>
        ) : isRecipient && completedEpisode ? (
          // One-and-done completion state. Warm and final; leads with belonging
          // (Circle) then the other supports. Never the request form.
          <div style={{ background: "#e8f5f1", border: "1px solid #c3e6cb", borderRadius: 14, padding: "28px 24px", marginTop: 20 }}>
            <h1 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: INK, margin: "0 0 10px" }}>
              Your formula support is complete
            </h1>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: "0 0 12px" }}>
              Your 6 months of formula support are complete{completedEpisode.completedAt ? ` — completed on ${formatCooldownDate(completedEpisode.completedAt)}` : ""}. 💛 Every month was sent. Formula support is a one-time, six-month program, and yours is now finished.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: "0 0 18px" }}>
              You&apos;re still fully part of the Kradel community. Your Circle — your stage cohort, your Reflections, and the mothers alongside you — is always here. So are your Register and Discover, whenever you need them.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/circles" style={{ display: "inline-block", padding: "11px 18px", background: GREEN, borderRadius: 10, fontSize: 13, fontWeight: 800, color: "white", fontFamily: SANS, textDecoration: "none" }}>
                Go to your Circle →
              </Link>
              <Link href="/registers" style={{ display: "inline-block", padding: "11px 18px", background: "white", border: "1.5px solid #c3e6cb", borderRadius: 10, fontSize: 13, fontWeight: 800, color: GREEN, fontFamily: SANS, textDecoration: "none" }}>
                Your Register
              </Link>
              <Link href="/browse" style={{ display: "inline-block", padding: "11px 18px", background: "white", border: "1.5px solid #c3e6cb", borderRadius: 10, fontSize: 13, fontWeight: 800, color: GREEN, fontFamily: SANS, textDecoration: "none" }}>
                Explore Discover
              </Link>
            </div>
          </div>
        ) : isRecipient && formulaCooldown.active && formulaCooldown.lastApprovedAt && formulaCooldown.nextEligibleAt ? (
          <div style={{ background: "#e8f5f1", border: "1px solid #c3e6cb", borderRadius: 14, padding: "28px 24px", marginTop: 20 }}>
            <h1 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: INK, margin: "0 0 10px" }}>
              You&apos;re set for this month
            </h1>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
              Your last formula support was approved on <strong style={{ color: INK }}>{formatCooldownDate(formulaCooldown.lastApprovedAt)}</strong>. To help us support as many babies as possible, formula is provided about a month at a time, so you can request again from <strong style={{ color: INK }}>{formatCooldownDate(formulaCooldown.nextEligibleAt)}</strong>.
            </p>
          </div>
        ) : isRecipient ? (
          <>
            <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: INK, margin: "18px 0 10px" }}>
              Request help with infant formula
            </h1>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: "0 0 8px" }}>
              This is for mothers whose babies are already formula-fed and who need help affording it. So your baby
              stays on exactly what they are used to, please tell us the precise formula they currently use. We fulfil
              only the formula your baby already has, never a substitute.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: "0 0 20px" }}>
              If you are also exploring breastfeeding support, let us know below and we can point you to resources.
            </p>
            <FormulaSupportForm />
          </>
        ) : (
          <div style={{ background: CARD, border: "1px solid #e8e8e8", borderRadius: 14, padding: "28px 24px", marginTop: 20 }}>
            <h1 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: INK, margin: "0 0 10px" }}>
              This is available to verified mother accounts
            </h1>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
              If you were referred to Kradel and need help, please complete your account setup first.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
