"use client";

import { useState } from "react";

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
  { label: "13–18 months",   months: 15  },
  { label: "19–24 months",   months: 21  },
];

const SUB_TAGS: { label: string; emoji: string; value: string }[] = [
  { emoji: "🌟", label: "First-time mom",    value: "First-time mom"    },
  { emoji: "👯", label: "Twins / multiples", value: "Twins / multiples" },
  { emoji: "🤱", label: "Breastfeeding",      value: "Breastfeeding"      },
  { emoji: "🍼", label: "Formula feeding",    value: "Formula feeding"    },
  { emoji: "💪", label: "Single parent",      value: "Single parent"      },
];

const now = new Date();
const currentYear = now.getFullYear();
const DUE_YEARS = [currentYear, currentYear + 1];

// step 0 = role picker, step 1 = due date / baby age, step 2 = sub-tags
// donor path: step 0 only (auto-submits on selection)

export default function OnboardingModal({ onComplete }: Props) {
  const [step, setStep]                 = useState(0);
  const [journey, setJourney]           = useState<Journey>(null);
  const [dueMonth, setDueMonth]         = useState<number>(now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2);
  const [dueYear, setDueYear]           = useState<number>(currentYear);
  const [babyAge, setBabyAge]           = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const totalSteps = journey === "donor" ? 1 : 3;

  const toggleTag = (v: string) =>
    setSelectedTags((t) => t.includes(v) ? t.filter((x) => x !== v) : [...t, v]);

  const selectRole = async (j: Journey) => {
    setJourney(j);
    if (j === "donor") {
      // donors skip straight to done
      await submitOnboarding(j, [], true);
    } else {
      setStep(1);
    }
  };

  const goStep3 = () => {
    if (journey === "postpartum" && babyAge === null) {
      setError("Please select your baby's age.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const submitOnboarding = async (
    jType: Journey,
    tags: string[],
    skip = false,
  ) => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        journeyType: jType,
        subTags: skip ? [] : tags,
      };
      if (jType === "pregnant") {
        body.dueMonth = dueMonth;
        body.dueYear  = dueYear;
      } else if (jType === "postpartum") {
        body.babyAgeMonths = babyAge;
      }
      // donor: no extra fields needed

      const res  = await fetch("/api/user/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

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
        {/* Progress dots — hidden while saving donor path */}
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
                  Welcome to Kradəl 💛
                </div>
                <div style={{ fontSize: 14, color: "var(--mid)", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
                  Which best describes you?
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { j: "pregnant"  as Journey, emoji: "🤰", title: "I'm pregnant",          sub: "Join your pregnancy stage circle"        },
                    { j: "postpartum"as Journey, emoji: "🤱", title: "I'm a mother",           sub: "Join your baby's age-stage circle"       },
                    { j: "donor"     as Journey, emoji: "🎁", title: "I'm a supporter / donor", sub: "Browse and donate items to families" },
                  ].map(({ j, emoji, title, sub }) => (
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
                      <span style={{ fontSize: 36 }}>{emoji}</span>
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
                      When is your baby due? 🤰
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
                      How old is your baby? 👶
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
                    onClick={() => setStep(0)}
                    style={{ flex: 1, padding: "12px", borderRadius: 14, border: "1.5px solid var(--border)", background: "transparent", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={goStep3}
                    style={{ flex: 2, padding: "12px", borderRadius: 14, border: "none", background: "var(--green)", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                  >
                    Continue →
                  </button>
                </div>
              </div>

              {/* ── Step 2: Sub-tags ─────────────────────────────────────── */}
              <div style={{ minWidth: "100%", padding: "24px 24px 32px" }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>
                  A little more about you ✨
                </div>
                <div style={{ fontSize: 13, color: "var(--mid)", textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>
                  Optional — helps others connect with you better.
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 28 }}>
                  {SUB_TAGS.map((t) => {
                    const active = selectedTags.includes(t.value);
                    return (
                      <button
                        key={t.value}
                        onClick={() => toggleTag(t.value)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "10px 18px", borderRadius: 24,
                          border: `2px solid ${active ? "var(--green)" : "var(--border)"}`,
                          background: active ? "var(--green-light)" : "var(--white)",
                          color: active ? "var(--green)" : "var(--mid)",
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                          fontFamily: "Nunito, sans-serif", transition: "all 0.15s",
                        }}
                      >
                        <span>{t.emoji}</span> {t.label}
                      </button>
                    );
                  })}
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: "var(--terra)", background: "#fdf0e8", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontWeight: 600 }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={() => submitOnboarding(journey, selectedTags)}
                  disabled={saving}
                  style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: "var(--green)", color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 10 }}
                >
                  {saving ? "Joining your circle…" : "Join my circle 💛"}
                </button>
                <button
                  onClick={() => submitOnboarding(journey, [], true)}
                  disabled={saving}
                  style={{ width: "100%", padding: "10px", borderRadius: 14, border: "none", background: "transparent", color: "var(--mid)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  Skip for now
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
