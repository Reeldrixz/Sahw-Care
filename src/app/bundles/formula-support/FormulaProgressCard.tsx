import { CheckCircle, Circle } from "lucide-react";
import { formatCooldownDate } from "@/lib/cooldowns";

// D/F4b: the mother's read-only "Month X of 6" view for an ACTIVE formula
// episode. No actions — she watches her 6-month schedule fill in as the admin
// marks each month fulfilled (D/F4c). Server-rendered; receives Prisma Dates.

const INK = "#1a1a1a";
const MUTED = "#555555";
const GREEN = "#1a7a5e";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

interface Delivery {
  monthIndex: number;
  status: string;
  scheduledFor: Date;
  fulfilledAt: Date | null;
}

interface Props {
  formulaBrand: string;
  formulaType: string;
  formulaStage: string;
  formulaForm: string | null;
  monthsTotal: number;
  deliveries: Delivery[];
}

export default function FormulaProgressCard({ formulaBrand, formulaType, formulaStage, formulaForm, monthsTotal, deliveries }: Props) {
  const months = [...deliveries].sort((a, b) => a.monthIndex - b.monthIndex);
  const fulfilledCount = months.filter((d) => d.status === "FULFILLED").length;
  // Earliest still-open month = what she's waiting on next.
  const nextExpected = months.find((d) => d.status !== "FULFILLED" && d.status !== "CANCELLED") ?? null;
  const remaining = monthsTotal - fulfilledCount;

  const specRow = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
      <span style={{ fontSize: 13, color: MUTED, fontFamily: SANS }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: INK, fontFamily: SANS, textAlign: "right" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ marginTop: 20 }}>
      {/* Progress header */}
      <div style={{ background: "#e8f5f1", border: "1px solid #c3e6cb", borderRadius: 14, padding: "26px 24px", marginBottom: 16 }}>
        {fulfilledCount === 0 ? (
          <>
            <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 8px" }}>
              Your formula support is active
            </h1>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
              We&apos;re preparing your first month now.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 8px" }}>
              Month {fulfilledCount} of {monthsTotal} received
            </h1>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
              {remaining} {remaining === 1 ? "month" : "months"} to go. We&apos;ll keep sending your baby&apos;s formula each month.
            </p>
          </>
        )}

        {/* Segmented progress bar */}
        <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
          {months.map((d) => {
            const isFulfilled = d.status === "FULFILLED";
            const isNext = nextExpected?.monthIndex === d.monthIndex;
            return (
              <div key={d.monthIndex} title={`Month ${d.monthIndex}`}
                style={{ flex: 1, height: 8, borderRadius: 20, background: isFulfilled ? GREEN : isNext ? "#a7d9c8" : "#d7ece4" }} />
            );
          })}
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #e8e8e8", borderRadius: 14, padding: "22px 22px" }}>
        {/* Next-expected callout */}
        {nextExpected && (
          <div style={{ background: "#f5faf8", border: "1px solid #dcefe8", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
            <span style={{ fontSize: 13.5, color: INK, fontFamily: SANS, lineHeight: 1.6 }}>
              Your next month is expected around <strong>{formatCooldownDate(nextExpected.scheduledFor)}</strong>.
            </span>
          </div>
        )}

        {/* Current spec */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, fontFamily: SANS }}>
          Your baby&apos;s formula
        </div>
        <div style={{ marginBottom: 20 }}>
          {specRow("Brand", formulaBrand)}
          {specRow("Type or line", formulaType)}
          {specRow("Stage", formulaStage)}
          {specRow("Form", formulaForm ?? "—")}
        </div>

        {/* 6-month schedule */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, fontFamily: SANS }}>
          Your {monthsTotal}-month schedule
        </div>
        <div>
          {months.map((d) => {
            const isFulfilled = d.status === "FULFILLED";
            const isCancelled = d.status === "CANCELLED";
            const isNext = nextExpected?.monthIndex === d.monthIndex;
            return (
              <div key={d.monthIndex} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ flexShrink: 0, display: "flex" }}>
                  {isFulfilled
                    ? <CheckCircle size={20} color={GREEN} strokeWidth={2} />
                    : <Circle size={20} color={isNext ? GREEN : "#c9ccd1"} strokeWidth={2} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isCancelled ? MUTED : INK, fontFamily: SANS }}>Month {d.monthIndex}</span>
                    {isNext && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: GREEN, background: "#e8f5f1", borderRadius: 20, padding: "2px 9px", fontFamily: SANS, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                        Next
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: MUTED, fontFamily: SANS, marginTop: 1 }}>
                    {isFulfilled
                      ? `Sent ${formatCooldownDate(d.fulfilledAt ?? d.scheduledFor)}`
                      : isCancelled
                        ? "Not sent"
                        : `Expected around ${formatCooldownDate(d.scheduledFor)}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Honest caveat */}
        <p style={{ fontSize: 13, color: MUTED, fontFamily: SANS, lineHeight: 1.7, margin: "18px 0 0" }}>
          Formula support provides your baby&apos;s formula for six months. We aim for every month, but can&apos;t always guarantee an uninterrupted schedule. You won&apos;t need to reapply.
        </p>
      </div>
    </div>
  );
}
