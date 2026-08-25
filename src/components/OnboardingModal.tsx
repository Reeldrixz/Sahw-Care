"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Baby, Users, Gift, Heart, Leaf } from "lucide-react";

interface Props {
  onComplete: () => void;
}

type Journey = "pregnant" | "postpartum" | "donor" | null;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const BABY_AGE_OPTIONS: { label: string; months: number }[] = [
  { label: "Under 4 weeks",  months: 0.5 },
  { label: "1 month",        months: 1   },
  { label: "2 months",       months: 2   },
  { label: "3 months",       months: 3   },
  { label: "4 months",       months: 4   },
  { label: "5 months",       months: 5   },
  { label: "6 months",       months: 6   },
  { label: "7 months",       months: 7   },
  { label: "8 months",       months: 8   },
  { label: "9 months",       months: 9   },
  { label: "10 months",      months: 10  },
  { label: "11 months",      months: 11  },
  { label: "12 months",      months: 12  },
  { label: "13-18 months",   months: 15  },
  { label: "19-24 months",   months: 21  },
];

const now = new Date();
const currentYear = now.getFullYear();
const DUE_YEARS = [currentYear, currentYear + 1];

// Steps:
// 0 → role picker (all users)
// 1 → due date (pregnant) or baby age (postpartum) — skipped for donor
// Donor submits immediately after step 0.

export default function OnboardingModal({ onComplete }: Props) {
  const router = useRouter();
  const [step, setStep]           = useState(0);
  const [journey, setJourney]     = useState<Journey>(null);
  const [dueMonth, setDueMonth]   = useState<number>(now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2);
  const [dueYear, setDueYear]     = useState<number>(currentYear);
  const [babyAge, setBabyAge]     = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [donorWelcome, setDonorWelcome] = useState(false);
  const [donorMotherAsk, setDonorMotherAsk] = useState(false);

  const totalSteps = 2;

  const selectRole = (j: Journey) => {
    setJourney(j);
    setError(null);
    if (j === "donor") {
      setDonorWelcome(true);
    } else {
      setStep(1);
    }
  };

  const submitOnboarding = async (jType: Journey, isMother?: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { journeyType: jType, subTags: [] };
      // Only sent when she actually answered; skipping leaves it unset so the
      // profile prompt still appears.
      if (typeof isMother === "boolean") body.isMother = isMother;
      if (jType === "pregnant") {
        body.dueMonth = dueMonth;
        body.dueYear  = dueYear;
      } else if (jType === "postpartum") {
        if (babyAge === null) {
          setError("Please select your baby's age.");
          setSaving(false);
          return;
        }
        body.babyAgeMonths = babyAge;
      }

      const res  = await fetch("/api/user/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      onComplete();
      // Self-serve pregnant/postpartum selection: mother role is referral-only,
      // so point them to the partner directory to get connected.
      if (data.redirectTo) router.push(data.redirectTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // ── Donor threshold screen ───────────────────────────────────────────────
  // ── Donor step 2: the motherhood ask ──────────────────────────────────────
  // A standalone moment, not crammed onto the welcome screen: this single
  // question is the entire eligibility on-ramp for Experiences. The copy makes
  // MOTHERHOOD the basis for belonging — "whatever brought you to Kradel" —
  // because giving must never be what buys a place in the mothers' community.
  if (donorMotherAsk) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}>
        <div style={{
          background: "var(--white)", borderRadius: 24, width: "100%", maxWidth: 460,
          padding: "36px 28px", textAlign: "center",
        }}>
          <div style={{ marginBottom: 18, opacity: 0.4 }}>
            <Leaf size={22} strokeWidth={1.5} color="#1a7a5e" />
          </div>

          <h2 style={{ fontFamily: "Lora, serif", fontSize: 23, fontWeight: 700, color: "#1a1a1a", margin: "0 0 12px" }}>
            Are you a mother?
          </h2>

          <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 14.5, color: "#555", lineHeight: 1.7, margin: "0 0 8px" }}>
            Kradel has a space called Experiences, where mothers write down what they&apos;ve
            learned — the practical things that help another mother later.
          </p>
          <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 14.5, color: "#555", lineHeight: 1.7, margin: "0 0 24px" }}>
            If you&apos;re a mother too, you&apos;re welcome there, whatever brought you to Kradel.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => submitOnboarding("donor", true)}
              disabled={saving}
              style={{
                width: "100%", padding: "15px", background: saving ? "#aaa" : "#1a7a5e",
                color: "white", border: "none", borderRadius: 14,
                fontFamily: "Nunito, sans-serif", fontSize: 15, fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Setting up…" : "Yes, I'm a mother"}
            </button>
            <button
              onClick={() => submitOnboarding("donor", false)}
              disabled={saving}
              style={{
                width: "100%", padding: "13px", background: "transparent",
                color: "#555", border: "1.5px solid var(--border)", borderRadius: 14,
                fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Not right now
            </button>
          </div>

          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#9ca3af", marginTop: 16, lineHeight: 1.6 }}>
            You can change this any time in your profile. We never show it to other people.
          </div>
        </div>
      </div>
    );
  }

  if (donorWelcome) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#faf8f3", zIndex: 600,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "40px 24px",
      }}>
        <div style={{ maxWidth: 600, width: "100%", textAlign: "center" }}>

          {/* Top accent */}
          <div style={{ marginBottom: 52 }}>
            <Heart size={28} strokeWidth={1.5} color="#1a7a5e" fill="none" />
          </div>

          {/* First line */}
          <p style={{
            fontFamily: "Lora, serif", fontSize: 24, fontWeight: 700,
            color: "#1a7a5e", lineHeight: 1.45, margin: "0 0 32px",
          }}>
            Kradel is built on compassion and mercy. Not convenience.
          </p>

          {/* Middle paragraph */}
          <p style={{
            fontFamily: "Lora, serif", fontSize: 16, fontStyle: "italic",
            color: "#2a2a2a", lineHeight: 1.85, margin: "0 0 32px",
          }}>
            If you&apos;re here, you&apos;re here because mothers deserve real support.
            The work isn&apos;t always easy. But it&apos;s always worth it.
          </p>

          {/* Final line */}
          <p style={{
            fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700,
            color: "#1a7a5e", lineHeight: 1.4, margin: "0 0 48px",
          }}>
            Welcome to the work.
          </p>

          {/* Bottom leaf accent */}
          <div style={{ marginBottom: 32, opacity: 0.35 }}>
            <Leaf size={20} strokeWidth={1.5} color="#1a7a5e" />
          </div>

          {/* Begin button */}
          <button
            onClick={() => setDonorMotherAsk(true)}
            disabled={saving}
            style={{
              width: "100%", maxWidth: 400, padding: "16px",
              background: saving ? "#aaa" : "#1a7a5e", color: "white",
              border: "none", borderRadius: 16,
              fontFamily: "Nunito, sans-serif", fontSize: 16, fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              letterSpacing: "0.01em",
            }}
          >
            {saving ? "Setting up…" : "Begin →"}
          </button>

        </div>
      </div>
    );
  }

  // ── Shell ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--white)", borderRadius: "24px 24px 0 0",
        width: "100%", maxWidth: 480,
        maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        {/* Progress dots */}
        {!saving && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "18px 0 0" }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                background: i <= step ? "var(--green)" : "var(--border)",
                transition: "all 0.3s",
              }} />
            ))}
          </div>
        )}

        {saving && journey === "donor" ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div className="spinner" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: 14, color: "var(--mid)" }}>Setting up your account…</div>
          </div>
        ) : (
          <div style={{ overflow: "hidden" }}>
            <div style={{
              display: "flex",
              transform: `translateX(-${step * 100}%)`,
              transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
            }}>

              {/* ── Step 0: Role ──────────────────────────────────────────── */}
              <div style={{ minWidth: "100%", padding: "24px 24px 32px" }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>
                  Welcome to Kradel
                </div>
                <div style={{ fontSize: 14, color: "var(--mid)", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
                  How would you like to use Kradel?
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { j: "pregnant"   as Journey, Icon: Baby,  title: "I'm pregnant",     sub: "Get support and access items for your pregnancy" },
                    { j: "postpartum" as Journey, Icon: Users, title: "I'm a mother",     sub: "Find items and connect with others on your journey" },
                    { j: "donor"      as Journey, Icon: Gift,  title: "I want to give", sub: "Share essential items with mothers in need"           },
                  ].map(({ j, Icon, title, sub }) => (
                    <button
                      key={j!}
                      disabled={saving}
                      onClick={() => selectRole(j)}
                      style={{
                        display: "flex", alignItems: "center", gap: 16,
                        padding: "20px 22px", borderRadius: 18,
                        border: "2px solid var(--border)",
                        background: "var(--white)", cursor: "pointer",
                        textAlign: "left", width: "100%",
                        transition: "border-color 0.2s, background 0.2s",
                        opacity: saving ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => { if (!saving) { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.background = "var(--green-light)"; }}}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--white)"; }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--green-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={22} strokeWidth={1.75} color="var(--green)" />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>{title}</div>
                        <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 2 }}>{sub}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: "var(--terra)", background: "#fdf0e8", padding: "8px 12px", borderRadius: 8, marginTop: 16, fontWeight: 600 }}>
                    {error}
                  </div>
                )}
              </div>

              {/* ── Step 1: Due date or Baby age ─────────────────────────── */}
              <div style={{ minWidth: "100%", padding: "24px 24px 32px" }}>
                {journey === "pregnant" ? (
                  <>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>
                      When is your baby due?
                    </div>
                    <div style={{ fontSize: 13, color: "var(--mid)", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
                      We&apos;ll place you in the right group based on your trimester.
                    </div>

                    <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Month</label>
                        <select
                          value={dueMonth}
                          onChange={(e) => setDueMonth(Number(e.target.value))}
                          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--border)", fontSize: 14, fontFamily: "Nunito, sans-serif", outline: "none", background: "var(--white)", color: "var(--ink)" }}
                        >
                          {MONTHS.map((m, i) => (
                            <option key={m} value={i + 1}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Year</label>
                        <select
                          value={dueYear}
                          onChange={(e) => setDueYear(Number(e.target.value))}
                          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--border)", fontSize: 14, fontFamily: "Nunito, sans-serif", outline: "none", background: "var(--white)", color: "var(--ink)" }}
                        >
                          {DUE_YEARS.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>
                      How old is your baby?
                    </div>
                    <div style={{ fontSize: 13, color: "var(--mid)", textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
                      Choose the closest match.
                    </div>

                    <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 12, border: "1.5px solid var(--border)", marginBottom: 16 }}>
                      {BABY_AGE_OPTIONS.map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => { setBabyAge(opt.months); setError(null); }}
                          style={{
                            display: "block", width: "100%", padding: "13px 18px",
                            borderBottom: "1px solid var(--border)", border: "none",
                            background: babyAge === opt.months ? "var(--green-light)" : "transparent",
                            color: babyAge === opt.months ? "var(--green)" : "var(--ink)",
                            fontSize: 14, fontWeight: babyAge === opt.months ? 800 : 500,
                            fontFamily: "Nunito, sans-serif", cursor: "pointer", textAlign: "left",
                            transition: "background 0.15s",
                          }}
                        >
                          {babyAge === opt.months && <span style={{ marginRight: 8 }}>✓</span>}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {error && (
                  <div style={{ fontSize: 12, color: "var(--terra)", background: "#fdf0e8", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontWeight: 600 }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { setStep(0); setError(null); }}
                    style={{ flex: 1, padding: "12px", borderRadius: 14, border: "1.5px solid var(--border)", background: "transparent", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => submitOnboarding(journey)}
                    disabled={saving}
                    style={{ flex: 2, padding: "12px", borderRadius: 14, border: "none", background: "var(--green)", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? "Setting up…" : "Let's go →"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
