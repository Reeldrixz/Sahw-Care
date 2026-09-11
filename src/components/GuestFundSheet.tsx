"use client";

import { useMemo, useState } from "react";
import { X, Loader2, ShieldCheck } from "lucide-react";
import { computeBreakdown, MIN_GIFT_CENTS } from "@/lib/checkoutFees";
import type { PublicRegisterItem } from "@/lib/registers";

// Guest funding. A logged-out viewer — typically someone who followed a host
// link mid-stream — pays without a Kradel account.
//
// The design problem here is trust in about twenty seconds. Someone who has
// never heard of Kradel is being asked for money and an email address by a site
// they arrived at from a livestream. So: say exactly who the money reaches, show
// every cent of the breakdown before they commit, and say plainly what the email
// is for — and what it is not for.
//
// The fee breakdown is computed with the SAME function the server uses, so the
// number shown is the number charged. It is not an estimate rendered separately
// and hoped to match.

const PRESETS = [1000, 2500, 5000];

export default function GuestFundSheet({
  item, firstName, onClose,
}: {
  item: PublicRegisterItem;
  firstName: string;
  onClose: () => void;
}) {
  const remaining = Math.max(0, item.standardPriceCents - item.totalFundedCents);

  const [amountStr, setAmountStr]   = useState(() => (remaining > 0 ? (remaining / 100).toFixed(0) : "25"));
  const [email, setEmail]           = useState("");
  const [coverStripe, setCover]     = useState(true);
  const [supportOn, setSupportOn]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const amountCents = Math.round(Number(amountStr) * 100) || 0;
  const valid = amountCents >= MIN_GIFT_CENTS && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  // Same helper the server uses — what you see is what Stripe charges.
  const breakdown = useMemo(
    () => computeBreakdown(amountCents > 0 ? amountCents : 0, supportOn, coverStripe),
    [amountCents, supportOn, coverStripe],
  );

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const r = await fetch("/api/guest/fund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registerItemId: item.id,
        amountCents,
        email: email.trim(),
        supportOn,
        coverStripe,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.sessionUrl) {
      setSubmitting(false);
      setError(d.error ?? "Something went wrong. Please try again.");
      return;
    }
    // Straight to Stripe. Deliberately not a new tab: a viewer on a phone
    // mid-stream should not have to find their way back between tabs.
    window.location.href = d.sessionUrl;
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", animation: "sheetUp 0.3s ease", padding: "18px 18px 34px" }}>
        <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
          {/* Context first. Who this reaches, before anything is asked for. */}
          <div>
            <div style={{ fontSize: 12, color: "var(--mid)", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>
              You&apos;re funding
            </div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, marginTop: 2 }}>
              {item.name}
            </div>
            <div style={{ fontSize: 13, color: "var(--mid)", marginTop: 3 }}>
              on {firstName}&apos;s register
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--light)" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {remaining > 0 && (
          <div style={{ fontSize: 12.5, color: "var(--mid)", marginTop: 10, padding: "8px 11px", background: "var(--bg)", borderRadius: 9 }}>
            ${(item.totalFundedCents / 100).toFixed(0)} of ${(item.standardPriceCents / 100).toFixed(0)} funded
            {" · "}${(remaining / 100).toFixed(0)} still needed
          </div>
        )}

        {/* Amount */}
        <div style={{ marginTop: 16 }}>
          <label style={label}>How much would you like to give?</label>
          <div style={{ display: "flex", gap: 7, marginBottom: 9 }}>
            {PRESETS.map((c) => (
              <button key={c} onClick={() => setAmountStr((c / 100).toFixed(0))} style={preset(amountCents === c)}>
                ${c / 100}
              </button>
            ))}
            {remaining >= MIN_GIFT_CENTS && (
              <button onClick={() => setAmountStr((remaining / 100).toFixed(0))} style={preset(amountCents === remaining)}>
                All ${(remaining / 100).toFixed(0)}
              </button>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: 11, fontSize: 15, color: "var(--mid)" }}>$</span>
            <input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              style={{ ...input, paddingLeft: 26, fontSize: 16, fontWeight: 700 }}
            />
          </div>
          {amountCents > 0 && amountCents < MIN_GIFT_CENTS && (
            <div style={{ fontSize: 11.5, color: "#b91c1c", marginTop: 5 }}>
              Minimum is ${MIN_GIFT_CENTS / 100}.
            </div>
          )}
        </div>

        {/* Email — with the framing stated, not implied */}
        <div style={{ marginTop: 16 }}>
          <label style={label}>Your email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            inputMode="email"
            style={input}
          />
          <div style={{ fontSize: 11.5, color: "var(--mid)", lineHeight: 1.6, marginTop: 6 }}>
            This is where your receipt goes, and where a refund would go if one&apos;s ever needed.
            We won&apos;t create an account for you, and we won&apos;t send you marketing.
          </div>
        </div>

        {/* Options */}
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <Toggle
            on={supportOn} onChange={setSupportOn}
            title="Add 10% to support Kradel"
            sub="Optional. Keeps the platform running for other mothers."
          />
          <Toggle
            on={coverStripe} onChange={setCover}
            title="Cover the card processing fee"
            sub="Optional. If you don't, it comes out of what reaches her."
          />
        </div>

        {/* Breakdown — every cent, before committing */}
        {amountCents >= MIN_GIFT_CENTS && (
          <div style={{ marginTop: 16, padding: "12px 13px", background: "var(--bg)", borderRadius: 11, fontSize: 12.5 }}>
            <Row label={`Toward ${item.name}`} value={breakdown.itemSubtotal} strong />
            <Row label="Kradel platform fee (7%)" value={breakdown.kradelFee} />
            {breakdown.optionalSupport > 0 && <Row label="Support for Kradel (10%)" value={breakdown.optionalSupport} />}
            {breakdown.stripeFee > 0 && <Row label="Card processing" value={breakdown.stripeFee} />}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>
              <span>You pay</span>
              <span>${(breakdown.total / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "9px 11px", lineHeight: 1.55 }}>
            {error}
          </div>
        )}

        <button
          disabled={!valid || submitting}
          onClick={submit}
          style={{
            width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 12, border: "none",
            background: valid && !submitting ? "#1a7a5e" : "var(--border)",
            color: "white", fontSize: 15, fontWeight: 800, fontFamily: "Nunito, sans-serif",
            cursor: valid && !submitting ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {submitting ? <><Loader2 size={16} className="spin" /> Taking you to checkout…</> : <>Continue to payment</>}
        </button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 11, fontSize: 11.5, color: "var(--light)" }}>
          <ShieldCheck size={13} strokeWidth={2} />
          Card details are handled by Stripe. Kradel never sees them.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: strong ? "var(--ink)" : "var(--mid)", fontWeight: strong ? 700 : 400 }}>
      <span>{label}</span>
      <span>${(value / 100).toFixed(2)}</span>
    </div>
  );
}

function Toggle({ on, onChange, title, sub }: { on: boolean; onChange: (v: boolean) => void; title: string; sub: string }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 12px", borderRadius: 11, border: `1.5px solid ${on ? "#1a7a5e" : "var(--border)"}`, background: on ? "#e8f5f1" : "white", cursor: "pointer" }}
    >
      <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1, border: `2px solid ${on ? "#1a7a5e" : "var(--border)"}`, background: on ? "#1a7a5e" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {on && <span style={{ color: "white", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "Nunito, sans-serif" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--mid)", lineHeight: 1.5, marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 800, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 7 };
const input: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, fontFamily: "inherit", color: "var(--ink)", background: "white" };
const preset = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer",
  border: `1.5px solid ${active ? "#1a7a5e" : "var(--border)"}`,
  background: active ? "#1a7a5e" : "white",
  color: active ? "white" : "var(--ink)",
});
