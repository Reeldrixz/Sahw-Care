"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageCircleQuestion, PencilLine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { STAGE_META, type StageKey } from "@/lib/stage";
import {
  EXPERIENCE_FIELDS,
  QUESTION_REDIRECT_LINE,
  SUBMITTED_HEADLINE,
  SUBMITTED_BODY,
  DRAFT_RESUBMITTED_HEADLINE,
  DRAFT_RESUBMITTED_BODY,
} from "@/lib/experienceSafety";

// Compose an experience — and the editor for a draft sent back for one change.
// One form for both: what she is asked for does not differ, and a separate edit
// screen would drift from this one the first time the wording changed.

const TOPICS: { value: string; label: string }[] = [
  { value: "FEEDING",          label: "Feeding" },
  { value: "SLEEP",            label: "Sleep" },
  { value: "RECOVERY",         label: "Recovery" },
  { value: "MENTAL_HEALTH",    label: "Mental health" },
  { value: "MEDICAL",          label: "Medical" },
  { value: "LOGISTICS_MONEY",  label: "Logistics & money" },
  { value: "RELATIONSHIPS",    label: "Relationships" },
];

const STAGES = Object.keys(STAGE_META) as StageKey[];

type Values = { situation: string; whatITried: string; takeaway: string };
const EMPTY: Values = { situation: "", whatITried: "", takeaway: "" };

function ComposeInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("draft");

  const [values,   setValues]   = useState<Values>(EMPTY);
  const [topic,    setTopic]    = useState("");
  const [stageKey, setStageKey] = useState<string>("");
  const [sendBackNote, setSendBackNote] = useState<string | null>(null);

  const [loadingDraft, setLoadingDraft] = useState(!!draftId);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [done,         setDone]         = useState<null | "created" | "resubmitted">(null);

  // Default the stage to where she is now — but it is her choice, and it is
  // skippable. Experiences is retrospective: the stage tags what the experience
  // is ABOUT, not where she stands today.
  useEffect(() => {
    if (!draftId && user?.currentStage && !stageKey) setStageKey(user.currentStage);
  }, [user, draftId, stageKey]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/");
  }, [user, authLoading, router]);

  const loadDraft = useCallback(async (id: string) => {
    const r = await fetch("/api/experiences/drafts", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      const found = (d.items ?? []).find((x: { id: string }) => x.id === id);
      if (found) {
        setValues({ situation: found.situation, whatITried: found.whatITried, takeaway: found.takeaway });
        setTopic(found.topic ?? "");
        setStageKey(found.stageKey ?? "");
        setSendBackNote(found.rejectionReasonForAuthor ?? null);
      } else {
        setError("We couldn't find that draft.");
      }
    }
    setLoadingDraft(false);
  }, []);

  useEffect(() => { if (draftId) loadDraft(draftId); }, [draftId, loadDraft]);

  const tooShort = (key: keyof Values) => {
    const f = EXPERIENCE_FIELDS.find((x) => x.key === key)!;
    return values[key].trim().length > 0 && values[key].trim().length < f.min;
  };

  const complete =
    EXPERIENCE_FIELDS.every((f) => values[f.key].trim().length >= f.min) && !!topic;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const r = await fetch("/api/experiences", {
      method: draftId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, topic, stageKey: stageKey || null, ...(draftId && { id: draftId }) }),
    });
    const d = await r.json().catch(() => ({}));
    setSubmitting(false);
    if (!r.ok) { setError(d.error ?? "Something went wrong. Please try again."); return; }
    setDone(draftId ? "resubmitted" : "created");
  };

  if (authLoading || !user) return null;

  // ── Not a mother: the gate, phrased as an invitation ────────────────────
  if (!user.isMother) {
    return (
      <Shell onBack={() => router.push("/profile")} title="Experiences">
        <div style={card}>
          <p style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.7, margin: 0 }}>
            Experiences is where mothers write down what they&apos;ve learned for the mothers
            coming up behind them. If you&apos;re a mother too, you&apos;re welcome there —
            whatever brought you to Kradel.
          </p>
          <button onClick={() => router.push("/profile/journey")} style={{ ...btnPrimary, marginTop: 14 }}>
            Let us know in your profile
          </button>
        </div>
      </Shell>
    );
  }

  // ── Confirmation ───────────────────────────────────────────────────────
  if (done) {
    const resub = done === "resubmitted";
    return (
      <Shell onBack={() => router.push("/profile")} title="Experiences">
        <div style={{ ...card, textAlign: "center" }}>
          <CheckCircle2 size={40} strokeWidth={1.75} color="#1a7a5e" style={{ margin: "4px auto 12px" }} />
          <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
            {resub ? DRAFT_RESUBMITTED_HEADLINE : SUBMITTED_HEADLINE}
          </div>
          <p style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.7, margin: "0 auto", maxWidth: 420 }}>
            {resub ? DRAFT_RESUBMITTED_BODY : SUBMITTED_BODY}
          </p>
          <button onClick={() => router.push("/profile")} style={{ ...btnPrimary, marginTop: 18 }}>
            Back to profile
          </button>
        </div>
      </Shell>
    );
  }

  if (loadingDraft) {
    return <Shell onBack={() => router.back()} title="Experiences">
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div>
    </Shell>;
  }

  return (
    <Shell
      onBack={() => router.push("/profile")}
      title={draftId ? "Edit your experience" : "Write an experience"}
      subtitle={draftId ? "One change, then it goes back to the team" : "For the mother coming up behind you"}
    >
      {/* The send-back note, if this is a draft coming back to her */}
      {sendBackNote && (
        <div style={{ ...card, background: "#fffbeb", border: "1px solid #fde68a", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#92400e", marginBottom: 8, fontFamily: "Nunito, sans-serif" }}>
            <PencilLine size={14} strokeWidth={2.5} /> From the team
          </div>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, color: "#78350f", lineHeight: 1.7, margin: 0 }}>
            {sendBackNote}
          </pre>
        </div>
      )}

      {/* The question redirect — before she writes, not after in a decline */}
      {!draftId && (
        <div
          onClick={() => router.push(user.currentCircleId ? `/circles/${user.currentCircleId}` : "/circles")}
          style={{ ...card, display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14, cursor: "pointer", background: "#eff6ff", border: "1px solid #bfdbfe" }}
        >
          <MessageCircleQuestion size={17} strokeWidth={2} color="#1d4ed8" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: "#1e3a8a", lineHeight: 1.6 }}>{QUESTION_REDIRECT_LINE}</div>
        </div>
      )}

      <div style={card}>
        {EXPERIENCE_FIELDS.map((f) => {
          const v = values[f.key];
          const short = tooShort(f.key);
          return (
            <div key={f.key} style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 3 }}>
                {f.label}
              </label>
              <div style={{ fontSize: 11.5, color: "var(--mid)", lineHeight: 1.55, marginBottom: 7 }}>{f.hint}</div>
              <textarea
                value={v}
                maxLength={f.max}
                placeholder={f.placeholder}
                onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                style={{
                  ...input,
                  minHeight: f.key === "whatITried" ? 132 : 84,
                  borderColor: short ? "#fca5a5" : "var(--border)",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: short ? "#b91c1c" : "var(--light)", marginTop: 4 }}>
                <span>{short ? `A little more — at least ${f.min} characters.` : ""}</span>
                <span>{v.trim().length}/{f.max}</span>
              </div>
            </div>
          );
        })}

        {/* Topic — required, fixed taxonomy so browse-by-topic stays coherent */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 7 }}>
            Topic
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {TOPICS.map((t) => (
              <button key={t.value} onClick={() => setTopic(t.value)} style={pill(topic === t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stage — hers to choose, and skippable */}
        <div style={{ marginBottom: 4 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 3 }}>
            Which stage was this about? <span style={{ fontWeight: 600, color: "var(--light)" }}>(optional)</span>
          </label>
          <div style={{ fontSize: 11.5, color: "var(--mid)", lineHeight: 1.55, marginBottom: 7 }}>
            The stage you were <em>in</em> when this happened — not where you are now. It helps
            the right mother find it at the right time.
          </div>
          <select value={stageKey} onChange={(e) => setStageKey(e.target.value)} style={input}>
            <option value="">Not tied to one stage</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_META[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ ...card, marginTop: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 12.5, lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      <button disabled={!complete || submitting} onClick={submit} style={{ ...btnPrimary, marginTop: 14, opacity: complete && !submitting ? 1 : 0.5, cursor: complete && !submitting ? "pointer" : "not-allowed" }}>
        {submitting ? "Sending…" : draftId ? "Send it back to the team" : "Send it to the team"}
      </button>
      <p style={{ fontSize: 11.5, color: "var(--light)", textAlign: "center", lineHeight: 1.6, marginTop: 10 }}>
        Someone reads every experience before it&apos;s published. Your name is never shown —
        posts are written by &ldquo;a mother&rdquo;.
      </p>
    </Shell>
  );
}

export default function ComposeExperiencePage() {
  return (
    <Suspense fallback={null}>
      <ComposeInner />
    </Suspense>
  );
}

function Shell({ children, onBack, title, subtitle }: {
  children: React.ReactNode; onBack: () => void; title: string; subtitle?: string;
}) {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 60 }}>
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 640, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{subtitle}</div>}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>{children}</div>
    </div>
  );
}

const card: React.CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 16, padding: 16 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.65, color: "var(--ink)", background: "white", resize: "vertical" };
const btnPrimary: React.CSSProperties = { width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: "#1a7a5e", color: "white", fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const pill = (active: boolean): React.CSSProperties => ({ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#1a7a5e" : "var(--border)"}`, background: active ? "#1a7a5e" : "white", color: active ? "white" : "var(--mid)", fontSize: 12.5, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer" });
